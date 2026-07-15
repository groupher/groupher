defmodule GroupherServer.CMS.ContentImport.Threads.Doc do
  @moduledoc """
  Prepares a fetched Snapshot through an isolated Workspace, detects its
  docs-as-code framework, and delegates source-navigation extraction to that
  framework adapter before producing a Snapshot-bound Plan.

  Docs preparation and planning stay outside the database apply transaction:

      Snapshot
         |
         v
      Workspace.materialize
         |
         +--> detect framework --> Framework.parse --> SourceTree
         |                                             |
         `---------------------------------------------+--> Preparation
                                                            |
                                                            v
      Snapshot + Preparation + Mapping/Diff ----------> Doc Plan
                                                            |
                                                            +--> content items
                                                            +--> assets
                                                            `--> navigation tree

  The final write path is entered by Orchestrator inside one Repo transaction:

      Doc Plan
         |
         +--> resolve/create Preview branch
         +--> resolve staged asset URLs
         +--> write selected Article Drafts
         `--> DocTree.Import.apply
                    |
                    v
               ApplyResult

  Preview branches contain Draft rows only. Conflict decisions and failed-asset
  policies are resolved before a page is admitted to the navigation projection.
  """

  @behaviour GroupherServer.CMS.ContentImport.ThreadAdapter

  alias GroupherServer.Repo
  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS.Articles.{Branch, Draft}

  alias GroupherServer.CMS.ContentImport.{
    ApplyResult,
    Diagnostic,
    Diff,
    Mapping,
    Preview,
    Snapshot,
    Workspace
  }

  alias GroupherServer.CMS.ContentImport.Plan, as: ContentPlan
  alias GroupherServer.CMS.ContentImport.Plan.Item
  alias GroupherServer.CMS.ContentImport.Preview.Item, as: PreviewItem

  alias GroupherServer.CMS.ContentImport.Threads.Doc.{
    ContentNormalizer,
    ItemPayload,
    ItemPreview,
    LinkResolver,
    PreviewPayload
  }

  alias GroupherServer.CMS.ContentImport.Threads.Doc.Plan, as: DocPlan
  alias GroupherServer.CMS.ContentImport.Threads.Doc.PlanPayload
  alias GroupherServer.CMS.ContentImport.Threads.Doc.Preparation
  alias GroupherServer.CMS.DocTree.Import, as: DocTreeImport
  alias GroupherServer.CMS.Model.{ArticleBranch, Community}

  alias GroupherServer.CMS.ContentImport.Threads.Doc.Frameworks.{
    Docusaurus,
    Fumadocs,
    MkDocs,
    Nextra,
    Rspress,
    Starlight,
    VitePress
  }

  @spec parse_tree(Path.t()) ::
          {:ok, GroupherServer.CMS.ContentImport.Threads.Doc.Framework.result()} | {:error, map()}
  def parse_tree(project_root) do
    case detect(project_root) do
      {:ok, adapter} -> adapter.parse(project_root)
      {:error, diagnostic} -> {:error, diagnostic}
    end
  end

  @spec prepare(Snapshot.t(), keyword()) ::
          {:ok, Preparation.t()} | {:error, Diagnostic.t() | map()}
  def prepare(%Snapshot{} = snapshot, opts \\ []) do
    with {:ok, workspace} <- Workspace.materialize(snapshot, opts) do
      try do
        with {:ok, adapter} <- detect(workspace.root),
             {:ok, %{tree: source_tree, diagnostics: diagnostics}} <-
               adapter.parse(workspace.root),
             {:ok, preparation} <-
               Preparation.new(snapshot, framework_key(adapter), source_tree, diagnostics) do
          {:ok, preparation}
        end
      after
        Workspace.cleanup(workspace)
      end
    end
  end

  @spec detect(Path.t()) :: {:ok, module()} | {:error, map()}
  def detect(project_root) do
    cond do
      fumadocs_project?(project_root) ->
        {:ok, Fumadocs}

      starlight_project?(project_root) ->
        {:ok, Starlight}

      mkdocs_project?(project_root) ->
        {:ok, MkDocs}

      docusaurus_project?(project_root) ->
        {:ok, Docusaurus}

      has_any?(project_root, [
        "docs/.vitepress/config.ts",
        "docs/.vitepress/config.js",
        ".vitepress/config.ts",
        ".vitepress/config.js"
      ]) ->
        {:ok, VitePress}

      rspress_project?(project_root) ->
        {:ok, Rspress}

      nextra_project?(project_root) ->
        {:ok, Nextra}

      true ->
        {:error,
         %{
           code: "unsupported_framework",
           severity: "error",
           message:
             "could not detect Fumadocs, Starlight, MkDocs, Docusaurus, VitePress, Rspress, or Nextra"
         }}
    end
  end

  @impl true
  def validate(%Snapshot{}, %{thread: :doc}, _opts), do: :ok

  def validate(%Snapshot{}, _thread_context, _opts) do
    {:error,
     [
       Diagnostic.error(
         "invalid_doc_thread_context",
         "Doc imports require a thread context with thread=:doc"
       )
     ]}
  end

  @impl true
  def plan(%Snapshot{} = snapshot, thread_context, plan_context) do
    mappings = Map.get(plan_context, :mappings, [])
    diff = Diff.build(snapshot, mappings, Map.get(plan_context, :local_hashes, %{}))
    options = Map.get(plan_context, :options, [])

    with {:ok, preparation} <- required_preparation(snapshot, plan_context),
         {:ok, target} <- plan_target(thread_context, options),
         {:ok, doc_plan} <-
           DocPlan.build(
             preparation.source_tree,
             target,
             mappings: mappings,
             id_generator: Keyword.get(options, :id_generator, &Ecto.UUID.generate/0)
           ),
         {:ok, items, assets, content_diagnostics} <-
           content_plan_items(snapshot, doc_plan, mappings, diff) do
      ContentPlan.new(%{
        thread: :doc,
        items: items,
        assets: assets,
        payload:
          PlanPayload.new!(%{
            schema_version: doc_plan["schemaVersion"],
            source: doc_plan["source"],
            target: doc_plan["target"],
            tree: doc_plan["tree"]
          }),
        diagnostics: snapshot.diagnostics ++ preparation.diagnostics ++ content_diagnostics
      })
    else
      {:error, diagnostics} when is_list(diagnostics) -> {:error, diagnostics}
      {:error, diagnostic} -> {:error, [diagnostic]}
    end
  end

  @impl true
  def project_preview(
        %ContentPlan{thread: :doc, payload: %PlanPayload{} = payload, items: items} = plan
      ) do
    preview_items =
      Enum.map(items, fn item ->
        PreviewItem.from_plan_item(item, ItemPreview.from_item_payload(item.payload))
      end)

    case Preview.new(
           :doc,
           payload.schema_version,
           PreviewPayload.from_plan_payload(payload),
           preview_items,
           plan.diagnostics
         ) do
      {:ok, preview} -> {:ok, preview}
      {:error, diagnostic} -> {:error, [diagnostic]}
    end
  end

  def project_preview(%ContentPlan{}) do
    {:error,
     [
       Diagnostic.error(
         "invalid_doc_preview_context",
         "Doc preview projection requires a Doc Plan"
       )
     ]}
  end

  @impl true
  def apply_in_transaction(%ContentPlan{thread: :doc} = plan, %User{} = actor, opts)
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

  def apply_in_transaction(%ContentPlan{}, _actor, _opts) do
    {:error,
     [Diagnostic.error("invalid_doc_apply_context", "Doc apply requires a Doc Plan and actor")]}
  end

  defp do_apply(plan, community, actor, opts) do
    failed_asset_keys =
      plan.assets
      |> Enum.filter(&(&1.status == :failed))
      |> Enum.map(& &1.asset_key)

    item_opts = Keyword.put(opts, :failed_asset_keys, failed_asset_keys)

    with {:ok, branch} <- resolve_preview_branch(plan, community, actor),
         {:ok, asset_projection, applied_assets} <-
           resolve_ready_assets(plan.assets, community, actor, opts),
         {:ok, applied_items, items_by_target} <-
           write_items(plan.items, community, branch, actor, asset_projection, item_opts),
         {:ok, _tree_result} <-
           DocTreeImport.apply(community, branch, plan.payload.tree, items_by_target),
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
             "doc_apply_failed",
             "Doc Preview import could not be applied",
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
           "doc_apply_transaction_required",
           "Doc apply_in_transaction requires an active Repo transaction"
         )
       ]}
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
             "doc_apply_community_required",
             "Doc apply requires a Community in options"
           )
         ]}
    end
  end

  defp validate_apply_assets(%ContentPlan{} = plan, opts) do
    cond do
      Keyword.get(opts, :dry_run, false) ->
        :ok

      Enum.any?(plan.assets, &(&1.status in [:pending, :staging])) ->
        {:error,
         [
           Diagnostic.error(
             "doc_assets_not_ready",
             "Doc apply requires every asset to finish staging"
           )
         ]}

      Enum.any?(plan.assets, &(&1.status == :failed)) and
          Keyword.get(opts, :failed_asset_policy) != :skip_items ->
        {:error,
         [
           Diagnostic.error(
             "doc_assets_failed",
             "failed assets require the explicit failed_asset_policy=:skip_items option"
           )
         ]}

      true ->
        :ok
    end
  end

  defp validate_conflict_policy(%ContentPlan{} = plan, opts) do
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
           "doc_conflict_policy_required",
           "conflicted Doc items require conflict_policy=:skip or :overwrite"
         )
       ]}
    else
      :ok
    end
  end

  defp resolve_preview_branch(plan, community, actor) do
    branch_payload = plan.payload.target["branch"] || %{}
    slug = branch_payload["slug"]

    case Branch.resolve(community, :doc, slug) do
      {:ok, %ArticleBranch{} = branch} ->
        if Branch.preview?(branch),
          do: {:ok, branch},
          else: {:error, {:custom, "Doc import target must be a Preview branch"}}

      {:error, _} ->
        Branch.create_preview(
          community,
          :doc,
          %{slug: slug, title: branch_payload["title"] || slug},
          actor
        )
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
      "doc_asset_resolver_required",
      "ready Doc assets require an asset_resolver during apply"
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
          "invalid_doc_asset_resolver_result",
          "asset_resolver returned an invalid result",
          details: inspect(other)
        )
    end
  end

  defp resolve_asset(_asset, _community, _actor, _resolver, _opts) do
    Diagnostic.error_result(
      "invalid_doc_asset_resolver",
      "asset_resolver must be a function with arity 4"
    )
  end

  defp write_items(items, community, branch, actor, asset_projection, opts) do
    failed_asset_keys =
      opts
      |> Keyword.get(:failed_asset_keys, [])
      |> MapSet.new()

    selected = Keyword.get(opts, :selected_external_refs)
    selected = if is_list(selected), do: MapSet.new(selected), else: nil

    items
    |> Enum.reduce_while({:ok, [], %{}}, fn item, {:ok, applied, by_target} ->
      case item_apply_decision(item, selected, failed_asset_keys, opts) do
        :skip ->
          result = %{
            external_ref: item.external_ref,
            target_ref: item.target_ref,
            status: :skipped
          }

          {:cont, {:ok, [result | applied], by_target}}

        :keep_existing ->
          result = %{
            external_ref: item.external_ref,
            target_ref: item.target_ref,
            status: :skipped
          }

          {:cont, {:ok, [result | applied], Map.put(by_target, item.target_ref, item)}}

        :apply ->
          case write_item(item, community, branch, actor, asset_projection) do
            {:ok, status} ->
              result = %{
                external_ref: item.external_ref,
                target_ref: item.target_ref,
                status: status
              }

              {:cont, {:ok, [result | applied], Map.put(by_target, item.target_ref, item)}}

            {:error, reason} ->
              {:halt, {:error, reason}}
          end
      end
    end)
    |> case do
      {:ok, applied, by_target} -> {:ok, Enum.reverse(applied), by_target}
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

      resolution in [:local_wins, :keep] ->
        :keep_existing

      resolution == :skip and item.action in [:update, :conflict, :skip] ->
        :keep_existing

      resolution == :skip ->
        :skip

      content["status"] == "failed" and Keyword.get(opts, :content_failure_policy) == :skip_items ->
        :skip

      failed_dependency? and Keyword.get(opts, :failed_asset_policy) == :skip_items ->
        :skip

      item.action == :conflict and Keyword.get(opts, :conflict_policy) == :skip ->
        :keep_existing

      item.action == :skip ->
        :keep_existing

      true ->
        :apply
    end
  end

  defp write_item(item, community, branch, actor, asset_projection) do
    content = item.payload.content

    with :ok <- validate_target_ref(item.target_ref),
         "normalized" <- content["status"],
         body when is_binary(body) <- content["body"] do
      body = replace_asset_placeholders(body, asset_projection)

      attrs = %{
        branch_id: branch.id,
        article_hash_id: item.target_ref,
        title: item.payload.title,
        slug: article_slug(item.payload),
        body: body
      }

      case Draft.read(community, :doc, item.target_ref, branch) do
        {:ok, _draft} ->
          case Draft.update(community, :doc, item.target_ref, attrs) do
            {:ok, _draft} -> {:ok, :updated}
            error -> error
          end

        {:error, _} ->
          case Draft.create(community, :doc, attrs, actor) do
            {:ok, _draft} -> {:ok, :created}
            error -> error
          end
      end
    else
      {:error, _} = error -> error
      _ -> {:error, {:custom, "Doc item does not contain normalized content"}}
    end
  end

  defp validate_target_ref(target_ref) do
    case Ecto.UUID.cast(target_ref) do
      {:ok, _uuid} -> :ok
      :error -> {:error, {:custom, "Doc item target_ref must be a UUID"}}
    end
  end

  defp article_slug(%ItemPayload{} = payload) do
    case payload.route do
      route when is_binary(route) and route != "" ->
        route
        |> String.split(["#", "?"], parts: 2)
        |> hd()
        |> String.trim("/")
        |> String.replace("/", "-")
        |> case do
          "" -> payload.slug || "index"
          slug -> slug
        end

      _ ->
        payload.slug || "index"
    end
  end

  defp replace_asset_placeholders(body, projection) do
    Enum.reduce(projection, body, fn {asset_key, url}, resolved ->
      String.replace(resolved, "content-import://asset/#{asset_key}", url)
    end)
  end

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

  defp required_preparation(snapshot, plan_context) do
    case Map.get(plan_context, :preparation) do
      %Preparation{} = preparation ->
        if Preparation.matches_snapshot?(preparation, snapshot) do
          {:ok, preparation}
        else
          Diagnostic.error_result(
            "doc_preparation_snapshot_mismatch",
            "Doc preparation does not belong to the supplied Snapshot"
          )
        end

      _ ->
        Diagnostic.error_result(
          "doc_preparation_required",
          "Doc planning requires a Snapshot-bound Preparation"
        )
    end
  end

  defp framework_key(Docusaurus), do: :docusaurus
  defp framework_key(Fumadocs), do: :fumadocs
  defp framework_key(MkDocs), do: :mkdocs
  defp framework_key(Nextra), do: :nextra
  defp framework_key(Rspress), do: :rspress
  defp framework_key(Starlight), do: :starlight
  defp framework_key(VitePress), do: :vitepress

  defp plan_target(thread_context, options) do
    branch_slug =
      Map.get(thread_context, :scope_ref) ||
        Keyword.get(options, :branch_slug)

    if is_binary(branch_slug) and branch_slug != "" do
      {:ok,
       %{
         branch_slug: branch_slug,
         branch_title: Keyword.get(options, :branch_title, "Imported docs")
       }}
    else
      Diagnostic.error_result(
        "preview_branch_slug_required",
        "a Preview Branch slug is required for the import plan"
      )
    end
  end

  defp content_plan_items(snapshot, doc_plan, mappings, diff) do
    entries_by_ref = Map.new(snapshot.entries, &{&1.external_ref, &1})
    mapped_refs = MapSet.new(mappings, &mapping_external_ref/1)
    statuses = Map.new(diff.items, &{&1.external_ref, &1.status})
    link_resolver = LinkResolver.new(doc_plan["documents"])

    doc_plan["documents"]
    |> Enum.reduce_while({:ok, [], %{}, []}, fn document, {:ok, items, assets, diagnostics} ->
      external_ref = document["sourceId"]

      case Map.fetch(entries_by_ref, external_ref) do
        {:ok, entry} ->
          {content, entry_assets, entry_diagnostics} =
            normalize_content(entry, snapshot, link_resolver)

          item =
            Item.new!(%{
              external_ref: external_ref,
              target_ref: document["articleHashId"],
              action:
                plan_action(
                  Map.get(statuses, external_ref),
                  MapSet.member?(mapped_refs, external_ref)
                ),
              source_revision: entry.revision,
              source_hash: entry.content_hash,
              payload: ItemPayload.new!(Map.put(document, "content", content))
            })

          assets = Enum.reduce(entry_assets, assets, &merge_asset/2)

          {:cont, {:ok, [item | items], assets, diagnostics ++ entry_diagnostics}}

        :error ->
          {:halt,
           Diagnostic.error_result(
             "doc_source_entry_missing",
             "Doc source tree references an Entry that is missing from the Snapshot",
             source_id: external_ref
           )}
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

  defp normalize_content(entry, snapshot, link_resolver) do
    case ContentNormalizer.normalize(entry, snapshot, link_resolver: link_resolver) do
      {:ok, result} ->
        {result.content, result.assets, result.diagnostics}

      {:error, diagnostics} ->
        {%{
           "status" => "failed",
           "schemaVersion" => ContentNormalizer.schema_version(),
           "diagnosticCodes" => Enum.map(diagnostics, & &1.code)
         }, [], diagnostics}
    end
  end

  defp merge_asset(asset, assets) do
    Map.update(assets, asset.asset_key, asset, fn existing ->
      %{existing | references: Enum.uniq(existing.references ++ asset.references)}
    end)
  end

  defp mapping_external_ref(%Mapping{external_ref: external_ref}), do: external_ref
  defp mapping_external_ref(%{external_ref: external_ref}), do: external_ref
  defp mapping_external_ref(%{"external_ref" => external_ref}), do: external_ref
  defp mapping_external_ref(%{"sourceId" => external_ref}), do: external_ref

  defp has_any?(root, paths), do: Enum.any?(paths, &File.regular?(Path.join(root, &1)))

  defp fumadocs_project?(root) do
    source_config? =
      has_any?(root, ["source.config.ts", "source.config.js", "source.config.mjs"]) or
        root
        |> Path.join("*/source.config.{ts,js,mjs}")
        |> Path.wildcard()
        |> Enum.any?()

    source_config? or package_dependency?(root, "fumadocs-core") or
      package_dependency?(root, "fumadocs-mdx")
  end

  defp starlight_project?(root) do
    config_paths =
      Enum.flat_map(
        ~w(astro.config.ts astro.config.js astro.config.mts astro.config.mjs),
        fn name ->
          [Path.join(root, name) | Path.wildcard(Path.join([root, "*", name]))]
        end
      )

    Enum.any?(config_paths, fn path ->
      case File.read(path) do
        {:ok, source} -> String.contains?(source, ["@astrojs/starlight", "starlight("])
        _ -> false
      end
    end)
  end

  defp mkdocs_project?(root) do
    has_any?(root, ["mkdocs.yml", "mkdocs.yaml"]) or
      root
      |> Path.join("*/mkdocs.{yml,yaml}")
      |> Path.wildcard()
      |> Enum.any?()
  end

  defp docusaurus_project?(root) do
    has_any?(root, [
      "docusaurus.config.ts",
      "docusaurus.config.js",
      "docusaurus.config.mts",
      "docusaurus.config.mjs"
    ]) or
      root
      |> Path.join("*/docusaurus.config.{ts,js,mts,mjs}")
      |> Path.wildcard()
      |> Enum.any?()
  end

  defp rspress_project?(root) do
    root_match? =
      has_any?(root, [
        "rspress.config.ts",
        "rspress.config.js",
        "rspress.config.mts",
        "rspress.config.mjs"
      ])

    nested_match? =
      root
      |> Path.join("*/rspress.config.{ts,js,mts,mjs}")
      |> Path.wildcard()
      |> Enum.any?()

    root_match? or nested_match?
  end

  defp nextra_project?(root) do
    content_meta? =
      has_any?(root, [
        "content/_meta.ts",
        "content/_meta.js",
        "content/_meta.mjs",
        "src/content/_meta.ts",
        "src/content/_meta.js",
        "src/content/_meta.mjs"
      ])

    app_meta? =
      ([Path.join(root, "app"), Path.join(root, "src/app")] ++
         Path.wildcard(Path.join(root, "*/app")) ++
         Path.wildcard(Path.join(root, "*/src/app")))
      |> Enum.flat_map(&Path.wildcard(Path.join(&1, "_meta{.global,}.{tsx,ts,jsx,js}")))
      |> Enum.any?()

    content_meta? or app_meta? or nextra_dependency?(root)
  end

  defp nextra_dependency?(root) do
    with {:ok, body} <- File.read(Path.join(root, "package.json")),
         {:ok, package} <- Jason.decode(body) do
      package
      |> Map.take(["dependencies", "devDependencies"])
      |> Map.values()
      |> Enum.any?(&(is_map(&1) and Map.has_key?(&1, "nextra")))
    else
      _ -> false
    end
  end

  defp package_dependency?(root, dependency) do
    ([Path.join(root, "package.json")] ++ Path.wildcard(Path.join(root, "*/package.json")))
    |> Enum.any?(fn path ->
      with {:ok, body} <- File.read(path),
           {:ok, package} <- Jason.decode(body) do
        package
        |> Map.take(["dependencies", "devDependencies"])
        |> Map.values()
        |> Enum.any?(&(is_map(&1) and Map.has_key?(&1, dependency)))
      else
        _ -> false
      end
    end)
  end
end
