defmodule GroupherServer.CMS.Import.Jobs do
  @moduledoc """
  Creates and projects bounded Docs ImportJobs without storing source bodies in Job JSONB.

      confirmed Preview intent
                |
                v
      validate target revision -> create Job + pending Items
                                          |
                              staging ----+---- failure/cancel
                                          |
                                          v
                                   atomic Persist apply

  `preview_ref` is the preview resource identity: a retry may return the existing Job
  only when the complete confirmed intent still matches.

  See `docs/import/import-architecture.md` and
  `docs/import/article-publish-import-refactor.md`.
  """

  import Ecto.Query, warn: false

  alias GroupherServer.{Accounts, CMS, Repo}
  alias CMS.Import.{Transaction, Model.Job.Item}
  alias CMS.ErrorCat
  alias CMS.Gate.Decision

  alias Accounts.Model.User
  alias CMS.Import.Model.{Connection, Job}
  alias CMS.Import.Model.Job.Body
  alias CMS.Import.{DocValidator, Process}
  alias CMS.Model.Community

  @doc "Creates or idempotently resumes the Job bound to one confirmed Preview intent."
  @spec create(Community.t(), User.t(), map()) :: {:ok, map()} | {:error, term()}
  def create(%Community{} = community, %User{} = actor, input) when is_map(input) do
    Transaction.run(fn ->
      # The preview identity is community-scoped, including across different source connections.
      Repo.one!(
        from(c in Community, where: c.id == ^community.id, select: c.id, lock: "FOR UPDATE")
      )

      case CMS.Gate.check_community_workflow_in_transaction(actor, :import_docs, community) do
        {:ok, _canonical} -> {:ok, :pass}
        {:error, reason} -> Repo.rollback(reason)
      end

      case Repo.get_by(Job, community_id: community.id, preview_ref: input.preview_ref) do
        %Job{actor_id: actor_id} = job when actor_id == actor.id ->
          resume_job(job, input)

        %Job{} ->
          Repo.rollback(
            ErrorCat.import_intent_conflict("previewRef is already bound to another actor")
          )

        nil ->
          start_job(community, actor, input)
      end
    end)
  end

  defp resume_job(job, input) do
    with {:ok, items} <- build_item_attrs(input.documents, job.target_tree, input.source_info),
         {:ok, :pass} <- assert_same_job(job, input, input.source_info, items) do
      project(job)
    else
      {:error, reason} -> Repo.rollback(reason)
    end
  end

  defp start_job(community, actor, %{documents: documents} = input) when is_list(documents) do
    confirmations =
      Map.new(documents, &{value(&1, "source_ref"), value(&1, "overwrite_confirmed") == true})

    with {:ok, :pass} <-
           DocValidator.validate_intent(
             community,
             input.source_info,
             input.target_tree,
             input.target_revision,
             confirmations
           ),
         {:ok, items} <- build_item_attrs(documents, input.target_tree, input.source_info),
         {:ok, connection} <- get_or_create_connection(community, input.source_info) do
      attrs = %{
        actor_id: actor.id,
        bad_smells: Map.get(input, :bad_smells, []),
        community_id: community.id,
        connection_id: connection.id,
        counts: counts(input.target_tree),
        dataset_ref: input.dataset_ref,
        preview_ref: input.preview_ref,
        progress: %{
          "bodies" => %{
            "pending" => length(items),
            "ready" => 0,
            "skipped" => 0,
            "failed" => 0,
            "total" => length(items)
          }
        },
        source_info: input.source_info,
        status: :staging,
        target_revision: input.target_revision,
        target_tree: input.target_tree,
        thread: :doc
      }

      create_new_job(attrs, items)
    else
      {:error, reason} -> Repo.rollback(reason)
    end
  end

  defp start_job(_, _, _), do: Repo.rollback(ErrorCat.custom("source documents must be a list"))

  defp create_new_job(attrs, item_attrs) do
    with {:ok, job} <- %Job{} |> Job.changeset(attrs) |> Repo.insert(),
         {:ok, _} <- insert_items(job, item_attrs) do
      project(job)
    else
      {:error, reason} -> Repo.rollback(reason)
    end
  end

  @doc "Returns the public Job projection scoped to one community."
  @spec get(Community.t(), Ecto.UUID.t()) :: {:ok, map()} | {:error, term()}
  def get(%Community{} = community, job_ref) do
    case get_record(community.id, job_ref) do
      {:ok, job} -> {:ok, project(job)}
      error -> error
    end
  end

  @doc "Returns a Job only when the current actor can import Docs into its Community."
  def get(%Community{} = community, job_ref, %User{} = actor) do
    case CMS.Gate.access_check(actor, :import_docs, community) do
      {:ok, canonical} -> get(canonical, job_ref)
      {:error, %Decision{} = decision} -> {:error, Decision.primary_error(decision)}
      {:error, reason} -> {:error, reason}
    end
  end

  @doc "Loads the internal Job record without projecting it for GraphQL."
  @spec get_record(pos_integer(), Ecto.UUID.t()) ::
          {:ok, Job.t()} | {:error, ErrorCat.error()}
  def get_record(community_id, job_ref) do
    case Repo.get_by(Job, community_id: community_id, hash_id: job_ref) do
      %Job{} = job -> {:ok, job}
      nil -> {:error, ErrorCat.import_job_not_found()}
    end
  end

  @doc "Locks one community Job for a staging, failure, cancel, or apply transaction."
  @spec lock_job(pos_integer(), Ecto.UUID.t()) ::
          {:ok, Job.t()} | {:error, ErrorCat.error()}
  def lock_job(community_id, job_ref) do
    case Repo.one(
           from(job in Job,
             where: job.community_id == ^community_id and job.hash_id == ^job_ref,
             lock: "FOR UPDATE"
           )
         ) do
      %Job{} = job -> {:ok, job}
      nil -> {:error, ErrorCat.import_job_not_found()}
    end
  end

  @doc "Marks an unfinished Job failed while preserving completed and cancelled terminal facts."
  @spec fail(Community.t(), Ecto.UUID.t(), String.t(), String.t()) ::
          {:ok, map()} | {:error, term()}
  def fail(%Community{} = community, job_ref, code, message)
      when is_binary(code) and is_binary(message) do
    Transaction.run(fn ->
      case lock_job(community.id, job_ref) do
        {:ok, job} ->
          if job.status in [:completed, :cancelled] do
            project(job)
          else
            job
            |> Job.changeset(%{
              error_code: String.slice(code, 0, 120),
              error_message: String.slice(message, 0, 2_000),
              status: :failed
            })
            |> Repo.update!()
            |> project()
          end

        {:error, reason} ->
          Repo.rollback(reason)
      end
    end)
  end

  @doc "Cancels an unfinished ImportJob and removes its staged BodyBags."
  @spec cancel(Community.t(), Ecto.UUID.t()) :: {:ok, map()} | {:error, term()}
  def cancel(%Community{} = community, job_ref) do
    Transaction.run(fn ->
      case lock_job(community.id, job_ref) do
        {:ok, job} ->
          if job.status == :completed do
            project(job)
          else
            Repo.delete_all(from(body in Body, where: body.job_id == ^job.id))

            job
            |> Job.changeset(%{
              error_code: nil,
              error_message: nil,
              status: :cancelled
            })
            |> Repo.update!()
            |> project()
          end

        {:error, reason} ->
          Repo.rollback(reason)
      end
    end)
  end

  @doc "Projects persisted Job facts into the stable API contract, including process state."
  @spec project(Job.t()) :: map()
  def project(%Job{} = job) do
    result = job.result || %{}

    %{
      bad_smells: job.bad_smells || [],
      counts: project_counts(result_or(result, "counts", job.counts || %{})),
      error_code: job.error_code,
      error_message: job.error_message,
      failed_items: result_or(result, "failedItems", []),
      first_imported_doc_id: result["firstImportedDocId"],
      job_ref: job.hash_id,
      process: Process.project(job),
      progress: job.progress || %{},
      skipped: result_or(result, "skipped", []),
      source_info: project_source_info(job.source_info),
      status: job.status,
      tree: result_or(result, "tree", job.target_tree)
    }
  end

  defp result_or(result, key, fallback), do: Map.get(result, key) || fallback

  defp project_source_info(source_info) do
    %{
      branch: value(source_info, "branch"),
      commit: value(source_info, "commit"),
      config_paths: value(source_info, "config_paths") || [],
      content_root: value(source_info, "content_root"),
      framework: value(source_info, "framework"),
      repo: value(source_info, "repo"),
      repo_url: value(source_info, "repo_url")
    }
  end

  defp project_counts(counts) do
    %{
      assets: value(counts, "assets") || 0,
      groups: value(counts, "groups") || 0,
      links: value(counts, "links") || 0,
      pages: value(counts, "pages") || 0,
      tabs: value(counts, "tabs") || 0
    }
  end

  defp build_item_attrs(documents, target_tree, source_info) when is_list(documents) do
    targets = DocValidator.page_targets(target_tree)

    documents
    |> Enum.reduce_while({:ok, [], MapSet.new()}, fn document, {:ok, items, refs} ->
      external_ref = value(document, "source_ref")
      target = Map.get(targets, external_ref)
      source_hash = value(document, "content_hash")

      case validate_item_source(external_ref, refs, target, source_hash) do
        {:ok, :pass} ->
          item = build_item(document, target, external_ref, source_hash, source_info)
          {:cont, {:ok, [item | items], MapSet.put(refs, external_ref)}}

        {:error, _reason} = error ->
          {:halt, error}
      end
    end)
    |> case do
      {:ok, [], _refs} ->
        {:error, ErrorCat.custom("Select at least one document to import")}

      {:ok, items, _refs} ->
        {:ok, Enum.reverse(items)}

      error ->
        error
    end
  end

  defp build_item_attrs(_documents, _target_tree, _source_info) do
    {:error, ErrorCat.custom("source documents must be a list")}
  end

  defp validate_item_source(external_ref, refs, target, source_hash) do
    cond do
      not is_binary(external_ref) or external_ref == "" ->
        {:error, ErrorCat.custom("sourceRef is required")}

      MapSet.member?(refs, external_ref) ->
        {:error, ErrorCat.custom("source documents contain a duplicate sourceRef")}

      not is_map(target) ->
        {:error, ErrorCat.custom("source document is missing from confirmed TargetTree")}

      not valid_source_hash?(source_hash) ->
        {:error, ErrorCat.custom("source document hash contract is invalid")}

      true ->
        {:ok, :pass}
    end
  end

  defp valid_source_hash?(source_hash) do
    is_binary(source_hash) and String.match?(source_hash, ~r/\Asource-md-v1:[0-9a-f]{64}\z/)
  end

  defp build_item(document, target, external_ref, source_hash, source_info) do
    metadata = %{
      "sizeBytes" => value(document, "size_bytes"),
      "sourcePath" => value(document, "source_path")
    }

    metadata =
      if value(document, "overwrite_confirmed") == true do
        Map.put(metadata, "overwriteConfirmed", true)
      else
        metadata
      end

    %{
      content_status: :pending,
      external_ref: external_ref,
      metadata: metadata,
      route: value(document, "route"),
      selected: true,
      slug: target["slug"],
      source_hash: source_hash,
      source_revision: value(source_info, "commit"),
      source_version: "source-md-v1",
      target_ref: target["docId"],
      title: value(document, "title")
    }
  end

  defp insert_items(job, attrs) do
    Enum.reduce_while(attrs, {:ok, :pass}, fn attrs, {:ok, _} ->
      case %Item{} |> Item.changeset(Map.put(attrs, :job_id, job.id)) |> Repo.insert() do
        {:ok, _item} -> {:cont, {:ok, :pass}}
        {:error, changeset} -> {:halt, {:error, changeset}}
      end
    end)
  end

  defp get_or_create_connection(community, source_info) do
    repo = value(source_info, "repo")
    branch = value(source_info, "branch")

    attrs = %{
      community_id: community.id,
      config: %{
        "branch" => branch,
        "repo" => repo,
        "repoUrl" => value(source_info, "repo_url")
      },
      connection_key: branch,
      platform: :github,
      source_ref: repo,
      status: :active
    }

    case Repo.get_by(Connection,
           community_id: community.id,
           platform: :github,
           source_ref: repo,
           connection_key: branch
         ) do
      %Connection{} = connection ->
        {:ok, connection}

      nil ->
        case %Connection{} |> Connection.changeset(attrs) |> Repo.insert() do
          {:ok, connection} ->
            {:ok, connection}

          {:error, _changeset} ->
            case Repo.get_by(Connection,
                   community_id: community.id,
                   platform: :github,
                   source_ref: repo,
                   connection_key: branch
                 ) do
              %Connection{} = connection -> {:ok, connection}
              nil -> {:error, ErrorCat.import_connection_create_failed()}
            end
        end
    end
  end

  defp assert_same_job(job, input, source_info, item_attrs) do
    persisted_items =
      Item
      |> where([item], item.job_id == ^job.id)
      |> select([item], %{
        external_ref: item.external_ref,
        metadata: item.metadata,
        route: item.route,
        selected: item.selected,
        slug: item.slug,
        source_hash: item.source_hash,
        source_revision: item.source_revision,
        source_version: item.source_version,
        target_ref: item.target_ref,
        title: item.title
      })
      |> Repo.all()
      |> Enum.map(&item_intent/1)
      |> Enum.sort()

    same? =
      job.dataset_ref == Map.fetch!(input, :dataset_ref) and
        job.source_info == source_info and
        job.target_revision == Map.fetch!(input, :target_revision) and
        job.target_tree == Map.fetch!(input, :target_tree)

    same? = same? and job.bad_smells == Map.get(input, :bad_smells, [])

    if same? and same_item_intent?(persisted_items, item_attrs) do
      {:ok, :pass}
    else
      {:error, ErrorCat.import_intent_conflict("previewRef is already bound to another intent")}
    end
  end

  defp same_item_intent?(persisted_items, item_attrs) do
    persisted_items ==
      item_attrs
      |> Enum.map(&item_intent/1)
      |> Enum.sort()
  end

  defp item_intent(item) do
    %{
      external_ref: value(item, "external_ref"),
      metadata: value(item, "metadata") || %{},
      route: value(item, "route"),
      selected: value(item, "selected"),
      slug: value(item, "slug"),
      source_hash: value(item, "source_hash"),
      source_revision: value(item, "source_revision"),
      source_version: value(item, "source_version"),
      target_ref: value(item, "target_ref"),
      title: value(item, "title")
    }
  end

  defp counts(target_tree) do
    tabs = Map.get(target_tree, "tabs", [])
    nodes = Enum.flat_map(tabs, &collect_target_nodes(Map.get(&1, "groups", [])))

    %{
      "assets" => 0,
      "groups" => Enum.count(nodes, &(&1["type"] == "group")),
      "links" => Enum.count(nodes, &(&1["type"] == "link")),
      "pages" => Enum.count(nodes, &(&1["type"] == "page")),
      "tabs" => length(tabs)
    }
  end

  defp collect_target_nodes(pages) do
    Enum.flat_map(pages, fn child ->
      [
        child
        | if(child["type"] == "group", do: collect_target_nodes(child["pages"]), else: [])
      ]
    end)
  end

  defp value(map, key), do: Map.get(map, key, Map.get(map, String.to_atom(key)))
end
