defmodule GroupherServer.CMS.ContentImport.Threads.Changelog do
  @moduledoc """
  Plans GitHub-style release records and writes them to Changelog Drafts.

      record Entries + Mapping/Diff
                   |
                   v
      normalize release content
                   |
                   +--> Plan.Item per release
                   +--> deduplicated Plan.Assets
                   `--> Changelog Preview

  Final apply is called only inside the Orchestrator transaction:

      Changelog Plan
            |
            +--> resolve main Changelog branch
            +--> resolve staged asset URLs
            +--> apply item selection/conflict policy
            `--> create/update Changelog Drafts
                         |
                         v
                    ApplyResult

  External release fetching and asset publication stay outside this adapter;
  Draft writes roll back with Mapping and Job completion.
  """

  @behaviour GroupherServer.CMS.ContentImport.ThreadAdapter

  alias GroupherServer.Repo
  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS.Articles.{Branch, Draft}

  alias GroupherServer.CMS.ContentImport.{
    ApplyResult,
    Diagnostic,
    Diff,
    Entry,
    Mapping,
    MarkdownNormalizer,
    Plan,
    Preview,
    Snapshot
  }

  alias GroupherServer.CMS.ContentImport.Plan.{Asset, Item}
  alias GroupherServer.CMS.ContentImport.Preview.Item, as: PreviewItem

  alias GroupherServer.CMS.ContentImport.Threads.Changelog.{
    ItemPayload,
    ItemPreview,
    PlanPayload,
    PreviewPayload
  }

  alias GroupherServer.CMS.Model.Community

  @impl true
  def validate(%Snapshot{} = snapshot, %{thread: :changelog}, _opts) do
    if Enum.all?(snapshot.entries, &(&1.kind == :record)),
      do: :ok,
      else:
        {:error,
         [
           Diagnostic.error(
             "invalid_changelog_entries",
             "Changelog imports require record Entries"
           )
         ]}
  end

  def validate(%Snapshot{}, _thread_context, _opts) do
    {:error,
     [
       Diagnostic.error(
         "invalid_changelog_thread_context",
         "Changelog imports require a thread context with thread=:changelog"
       )
     ]}
  end

  @impl true
  def plan(%Snapshot{} = snapshot, thread_context, plan_context) do
    mappings = Map.get(plan_context, :mappings, [])
    diff = Diff.build(snapshot, mappings, Map.get(plan_context, :local_hashes, %{}))
    options = Map.get(plan_context, :options, [])

    with :ok <- validate(snapshot, thread_context, options),
         {:ok, items, assets, diagnostics} <- plan_items(snapshot, mappings, diff, options) do
      Plan.new(%{
        thread: :changelog,
        items: items,
        assets: assets,
        payload:
          PlanPayload.new!(%{
            schema_version: MarkdownNormalizer.schema_version(),
            source: %{
              "platform" => Atom.to_string(snapshot.platform),
              "sourceRef" => snapshot.source_ref,
              "revision" => snapshot.revision
            },
            target: %{"thread" => "changelog", "branch" => "main", "stage" => "draft"}
          }),
        diagnostics: snapshot.diagnostics ++ diagnostics
      })
    else
      {:error, diagnostics} when is_list(diagnostics) -> {:error, diagnostics}
      {:error, diagnostic} -> {:error, [diagnostic]}
    end
  end

  @impl true
  def project_preview(
        %Plan{thread: :changelog, payload: %PlanPayload{} = payload, items: items} = plan
      ) do
    preview_items =
      Enum.map(items, fn item ->
        PreviewItem.from_plan_item(item, ItemPreview.from_item_payload(item.payload))
      end)

    case Preview.new(
           :changelog,
           payload.schema_version,
           PreviewPayload.from_plan_payload(payload),
           preview_items,
           plan.diagnostics
         ) do
      {:ok, preview} -> {:ok, preview}
      {:error, diagnostic} -> {:error, [diagnostic]}
    end
  end

  def project_preview(%Plan{}) do
    {:error,
     [
       Diagnostic.error(
         "invalid_changelog_preview_context",
         "Changelog preview projection requires a Changelog Plan"
       )
     ]}
  end

  defp plan_items(snapshot, mappings, diff, options) do
    mappings_by_ref = mappings_by_ref(mappings)
    statuses = Map.new(diff.items, &{&1.external_ref, &1.status})
    id_generator = Keyword.get(options, :id_generator, &Ecto.UUID.generate/0)

    snapshot.entries
    |> Enum.reduce_while({:ok, [], %{}, []}, fn entry, {:ok, items, assets, diagnostics} ->
      case normalize_entry(entry, snapshot) do
        {:ok, result} ->
          target_ref = target_ref(entry.external_ref, mappings_by_ref, id_generator)

          item =
            Item.new!(%{
              external_ref: entry.external_ref,
              target_ref: target_ref,
              action:
                plan_action(
                  Map.get(statuses, entry.external_ref),
                  Map.has_key?(mappings_by_ref, entry.external_ref)
                ),
              source_revision: entry.revision,
              source_hash: entry.content_hash,
              payload: item_payload(entry, result.content)
            })

          assets = Enum.reduce(result.assets, assets, &merge_asset/2)

          {:cont, {:ok, [item | items], assets, diagnostics ++ result.diagnostics}}

        {:error, entry_diagnostics} ->
          target_ref = target_ref(entry.external_ref, mappings_by_ref, id_generator)

          item =
            Item.new!(%{
              external_ref: entry.external_ref,
              target_ref: target_ref,
              action:
                plan_action(
                  Map.get(statuses, entry.external_ref),
                  Map.has_key?(mappings_by_ref, entry.external_ref)
                ),
              source_revision: entry.revision,
              source_hash: entry.content_hash,
              payload:
                item_payload(entry, %{
                  "status" => "failed",
                  "schemaVersion" => MarkdownNormalizer.schema_version(),
                  "diagnosticCodes" => Enum.map(entry_diagnostics, & &1.code)
                })
            })

          {:cont, {:ok, [item | items], assets, diagnostics ++ entry_diagnostics}}
      end
    end)
    |> case do
      {:ok, items, assets, diagnostics} ->
        {:ok, Enum.reverse(items), assets |> Map.values() |> Enum.sort_by(& &1.asset_key),
         diagnostics}

      error ->
        error
    end
  end

  defp plan_action(:new, _mapped?), do: :create
  defp plan_action(:source_updated, _mapped?), do: :update
  defp plan_action(:in_sync, _mapped?), do: :skip
  defp plan_action(:local_updated, _mapped?), do: :skip
  defp plan_action(:conflict, _mapped?), do: :conflict
  defp plan_action(_status, true), do: :update
  defp plan_action(_status, false), do: :create

  defp normalize_entry(%Entry{} = entry, snapshot) do
    MarkdownNormalizer.normalize(entry, snapshot)
  end

  defp item_payload(entry, content) do
    ItemPayload.new!(%{
      title: entry.title,
      tag_name: metadata(entry, "tag_name"),
      published_at: metadata(entry, "published_at"),
      prerelease: metadata(entry, "prerelease") == true,
      source_url: entry.source_url,
      content: content
    })
  end

  defp mappings_by_ref(mappings) do
    mappings
    |> Enum.filter(&(mapping_thread(&1) == :changelog))
    |> Map.new(&{mapping_external_ref(&1), mapping_target_ref(&1)})
  end

  defp target_ref(external_ref, mappings, id_generator) do
    Map.get_lazy(mappings, external_ref, id_generator)
  end

  defp merge_asset(%Asset{} = asset, assets) do
    Map.update(assets, asset.asset_key, asset, fn existing ->
      %{existing | references: Enum.uniq(existing.references ++ asset.references)}
    end)
  end

  @impl true
  def apply_in_transaction(%Plan{thread: :changelog} = plan, %User{} = actor, opts)
      when is_list(opts) do
    with :ok <- ensure_transaction(),
         {:ok, community} <- apply_community(opts),
         :ok <- validate_apply_assets(plan, opts),
         :ok <- validate_conflict_policy(plan, opts) do
      if Keyword.get(opts, :dry_run, false),
        do: dry_run_result(plan),
        else: do_apply(plan, community, actor, opts)
    end
  end

  def apply_in_transaction(%Plan{}, _actor, _opts) do
    {:error,
     [
       Diagnostic.error(
         "invalid_changelog_apply_context",
         "Changelog apply requires a Changelog Plan and actor"
       )
     ]}
  end

  defp do_apply(plan, community, actor, opts) do
    item_opts =
      Keyword.put(opts, :failed_assets, Enum.filter(plan.assets, &(&1.status == :failed)))

    with {:ok, branch} <- Branch.resolve(community, :changelog, Branch.main_slug()),
         {:ok, asset_projection, applied_assets} <-
           resolve_ready_assets(plan.assets, community, actor, opts),
         {:ok, applied_items} <-
           write_items(plan.items, community, branch, actor, asset_projection, item_opts),
         {:ok, result} <-
           ApplyResult.new(%{
             items: applied_items,
             assets: applied_assets,
             diagnostics: plan.diagnostics
           }) do
      {:ok, result}
    else
      {:error, diagnostics} when is_list(diagnostics) ->
        {:error, diagnostics}

      {:error, %{code: _code} = diagnostic} ->
        {:error, [diagnostic]}

      {:error, reason} ->
        {:error,
         [
           Diagnostic.error(
             "changelog_apply_failed",
             "Changelog import could not be applied",
             details: inspect(reason)
           )
         ]}
    end
  end

  defp ensure_transaction do
    if Repo.in_transaction?() do
      :ok
    else
      {:error,
       [
         Diagnostic.error(
           "changelog_apply_transaction_required",
           "Changelog apply_in_transaction requires an active Repo transaction"
         )
       ]}
    end
  end

  defp write_items(items, community, branch, actor, asset_projection, opts) do
    selected = Keyword.get(opts, :selected_external_refs)
    selected = if is_list(selected), do: MapSet.new(selected), else: nil
    failed_asset_keys = failed_asset_keys(opts)

    items
    |> Enum.reduce_while({:ok, []}, fn item, {:ok, applied} ->
      case item_apply_decision(item, selected, failed_asset_keys, opts) do
        :skip ->
          result = %{
            external_ref: item.external_ref,
            target_ref: item.target_ref,
            status: :skipped
          }

          {:cont, {:ok, [result | applied]}}

        :apply ->
          case write_item(item, community, branch, actor, asset_projection) do
            {:ok, status} ->
              result = %{
                external_ref: item.external_ref,
                target_ref: item.target_ref,
                status: status
              }

              {:cont, {:ok, [result | applied]}}

            {:error, reason} ->
              {:halt, {:error, reason}}
          end
      end
    end)
    |> case do
      {:ok, applied} -> {:ok, Enum.reverse(applied)}
      error -> error
    end
  end

  defp item_apply_decision(item, selected, failed_asset_keys, opts) do
    content = item.payload.content
    asset_keys = Map.get(content, "assetKeys", [])
    selected? = is_nil(selected) or MapSet.member?(selected, item.external_ref)
    failed_dependency? = Enum.any?(asset_keys, &MapSet.member?(failed_asset_keys, &1))
    resolution = get_in(Keyword.get(opts, :item_resolutions, %{}), [item.external_ref])

    cond do
      not selected? ->
        :skip

      resolution == :source_wins ->
        :apply

      resolution in [:local_wins, :keep, :skip] ->
        :skip

      item.action == :skip ->
        :skip

      item.action == :conflict and Keyword.get(opts, :conflict_policy) == :skip ->
        :skip

      content["status"] == "failed" and Keyword.get(opts, :content_failure_policy) == :skip_items ->
        :skip

      failed_dependency? and Keyword.get(opts, :failed_asset_policy) == :skip_items ->
        :skip

      true ->
        :apply
    end
  end

  defp write_item(item, community, branch, actor, asset_projection) do
    content = item.payload.content

    with :ok <- validate_target_ref(item.target_ref),
         "normalized" <- content["status"],
         body when is_binary(body) <- content["body"] do
      attrs = %{
        branch_id: branch.id,
        article_hash_id: item.target_ref,
        title: item.payload.title,
        link_addr: item.payload.source_url,
        active_at: published_at(item.payload.published_at),
        body: replace_asset_placeholders(body, asset_projection)
      }

      case Draft.read(community, :changelog, item.target_ref, branch) do
        {:ok, _draft} ->
          case Draft.update(community, :changelog, item.target_ref, attrs) do
            {:ok, _draft} -> {:ok, :updated}
            error -> error
          end

        {:error, _} ->
          case Draft.create(community, :changelog, attrs, actor) do
            {:ok, _draft} -> {:ok, :created}
            error -> error
          end
      end
    else
      {:error, _} = error -> error
      _ -> {:error, {:custom, "Changelog item does not contain normalized content"}}
    end
  end

  defp apply_community(opts) do
    case Keyword.get(opts, :community) do
      %Community{} = community ->
        {:ok, community}

      _ ->
        {:error,
         [
           Diagnostic.error(
             "changelog_apply_community_required",
             "Changelog apply requires a Community in options"
           )
         ]}
    end
  end

  defp validate_apply_assets(%Plan{} = plan, opts) do
    cond do
      Keyword.get(opts, :dry_run, false) ->
        :ok

      Enum.any?(plan.assets, &(&1.status in [:pending, :staging])) ->
        {:error,
         [
           Diagnostic.error(
             "changelog_assets_not_ready",
             "Changelog apply requires every asset to finish staging"
           )
         ]}

      Enum.any?(plan.assets, &(&1.status == :failed)) and
          Keyword.get(opts, :failed_asset_policy) != :skip_items ->
        {:error,
         [
           Diagnostic.error(
             "changelog_assets_failed",
             "failed assets require the explicit failed_asset_policy=:skip_items option"
           )
         ]}

      true ->
        :ok
    end
  end

  defp validate_conflict_policy(%Plan{} = plan, opts) do
    resolutions = Keyword.get(opts, :item_resolutions, %{})

    unresolved_conflict? =
      Enum.any?(plan.items, fn item ->
        item.action == :conflict and
          Map.get(resolutions, item.external_ref) not in [:source_wins, :local_wins, :skip]
      end)

    if unresolved_conflict? and Keyword.get(opts, :conflict_policy) not in [:skip, :overwrite] do
      {:error,
       [
         Diagnostic.error(
           "changelog_conflict_policy_required",
           "conflicted Changelog items require conflict_policy=:skip or :overwrite"
         )
       ]}
    else
      :ok
    end
  end

  defp resolve_ready_assets(assets, community, actor, opts) do
    resolver = Keyword.get(opts, :asset_resolver)

    assets
    |> Enum.reduce_while({:ok, %{}, []}, fn
      %{status: :failed}, {:ok, projection, applied} ->
        {:cont, {:ok, projection, applied}}

      asset, {:ok, projection, applied} ->
        case resolve_asset(asset, community, actor, resolver, opts) do
          {:ok, resolved} ->
            applied_asset = %{
              asset_key: asset.asset_key,
              target_ref: resolved.target_ref,
              status: resolved.status
            }

            {:cont,
             {:ok, Map.put(projection, asset.asset_key, resolved.url), [applied_asset | applied]}}

          {:error, diagnostic} ->
            {:halt, {:error, [diagnostic]}}
        end
    end)
    |> case do
      {:ok, projection, applied} -> {:ok, projection, Enum.reverse(applied)}
      error -> error
    end
  end

  defp resolve_asset(_asset, _community, _actor, nil, _opts) do
    Diagnostic.error_result(
      "changelog_asset_resolver_required",
      "ready Changelog assets require an asset_resolver during apply"
    )
  end

  defp resolve_asset(asset, community, actor, resolver, opts) when is_function(resolver, 4) do
    case resolver.(asset, community, actor, opts) do
      {:ok, %{target_ref: target_ref, url: url, status: status} = resolved}
      when is_binary(target_ref) and target_ref != "" and is_binary(url) and url != "" and
             status in [:created, :reused, :skipped] ->
        {:ok, resolved}

      {:error, %{code: _code} = diagnostic} ->
        {:error, diagnostic}

      other ->
        Diagnostic.error_result(
          "invalid_changelog_asset_resolver_result",
          "asset_resolver returned an invalid result",
          details: inspect(other)
        )
    end
  end

  defp resolve_asset(_asset, _community, _actor, _resolver, _opts) do
    Diagnostic.error_result(
      "invalid_changelog_asset_resolver",
      "asset_resolver must be a function with arity 4"
    )
  end

  defp failed_asset_keys(opts) do
    opts
    |> Keyword.get(:failed_assets, [])
    |> Enum.map(& &1.asset_key)
    |> MapSet.new()
  end

  defp validate_target_ref(target_ref) do
    case Ecto.UUID.cast(target_ref) do
      {:ok, _uuid} -> :ok
      :error -> {:error, {:custom, "Changelog item target_ref must be a UUID"}}
    end
  end

  defp replace_asset_placeholders(body, projection) do
    Enum.reduce(projection, body, fn {asset_key, url}, resolved ->
      String.replace(resolved, "content-import://asset/#{asset_key}", url)
    end)
  end

  defp published_at(value) when is_binary(value) do
    case DateTime.from_iso8601(value) do
      {:ok, datetime, _offset} -> datetime
      _ -> nil
    end
  end

  defp published_at(_value), do: nil

  defp dry_run_result(plan) do
    ApplyResult.new(%{
      items:
        Enum.map(plan.items, fn item ->
          %{external_ref: item.external_ref, target_ref: item.target_ref, status: :skipped}
        end),
      assets:
        Enum.map(plan.assets, fn asset ->
          %{asset_key: asset.asset_key, target_ref: asset.asset_key, status: :skipped}
        end),
      diagnostics: plan.diagnostics
    })
  end

  defp metadata(entry, key) do
    Map.get(entry.metadata, key) ||
      Enum.find_value(entry.metadata, fn {metadata_key, value} ->
        if to_string(metadata_key) == key, do: value
      end)
  end

  defp mapping_external_ref(%Mapping{external_ref: value}), do: value
  defp mapping_external_ref(%{external_ref: value}), do: value
  defp mapping_external_ref(%{"external_ref" => value}), do: value

  defp mapping_target_ref(%Mapping{target_ref: value}), do: value
  defp mapping_target_ref(%{target_ref: value}), do: value
  defp mapping_target_ref(%{"target_ref" => value}), do: value

  defp mapping_thread(%Mapping{thread: value}), do: value
  defp mapping_thread(%{thread: value}), do: value
  defp mapping_thread(%{"thread" => "changelog"}), do: :changelog
  defp mapping_thread(%{"thread" => value}), do: value
end
