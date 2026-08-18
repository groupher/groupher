defmodule GroupherServer.CMS.ContentImport.Jobs do
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
                                   atomic Writer apply

  `preview_ref` is the idempotency boundary: a retry may return the existing Job
  only when the complete confirmed intent still matches.

  See `docs/bulk-import/content-import-architecture.md` and
  `docs/bulk-import/article-publish-import-refactor.md`.
  """

  import Ecto.Query, warn: false

  alias GroupherServer.Repo
  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS.Docs.Branch
  alias GroupherServer.CMS.ContentImport.Process
  alias GroupherServer.CMS.ContentImport.Persistence.Connection
  alias GroupherServer.CMS.ContentImport.Persistence.Job
  alias GroupherServer.CMS.ContentImport.Persistence.Job.Body, as: StagedBody
  alias GroupherServer.CMS.ContentImport.Persistence.Job.Item
  alias GroupherServer.CMS.ContentImport.Threads.Doc.Validator
  alias GroupherServer.CMS.Model.Community

  @doc "Creates or idempotently resumes the Job bound to one confirmed Preview intent."
  @spec create(Community.t(), User.t(), map()) :: {:ok, map()} | {:error, term()}
  def create(%Community{} = community, %User{} = actor, input) when is_map(input) do
    source_info = Map.fetch!(input, :source_info)
    target_tree = Map.fetch!(input, :target_tree)
    target_revision = Map.fetch!(input, :target_revision)
    documents = Map.fetch!(input, :documents)

    with :ok <- Validator.validate_intent(community, source_info, target_tree, target_revision),
         {:ok, item_attrs} <- build_item_attrs(documents, target_tree, source_info),
         {:ok, connection} <- get_or_create_connection(community, source_info) do
      Repo.transaction(fn ->
        case Repo.get_by(Job,
               community_id: community.id,
               preview_ref: Map.fetch!(input, :preview_ref)
             ) do
          %Job{} = job ->
            with :ok <- assert_same_job(job, input, source_info, item_attrs) do
              project(job)
            else
              {:error, reason} -> Repo.rollback(reason)
            end

          nil ->
            attrs = %{
              actor_id: actor.id,
              bad_smells: Map.get(input, :bad_smells, []),
              community_id: community.id,
              connection_id: connection.id,
              counts: counts(target_tree),
              dataset_ref: Map.fetch!(input, :dataset_ref),
              preview_ref: Map.fetch!(input, :preview_ref),
              progress: %{
                "bodies" => %{
                  "pending" => length(item_attrs),
                  "ready" => 0,
                  "skipped" => 0,
                  "failed" => 0,
                  "total" => length(item_attrs)
                }
              },
              source_info: source_info,
              status: :staging,
              target_revision: target_revision,
              target_tree: target_tree,
              thread: :doc
            }

            with {:ok, job} <- %Job{} |> Job.changeset(attrs) |> Repo.insert(),
                 :ok <- insert_items(job, item_attrs) do
              project(job)
            else
              {:error, reason} -> Repo.rollback(reason)
            end
        end
      end)
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

  @doc "Loads the internal Job record without projecting it for GraphQL."
  @spec get_record(pos_integer(), Ecto.UUID.t()) :: {:ok, Job.t()} | {:error, :not_found}
  def get_record(community_id, job_ref) do
    case Repo.get_by(Job, community_id: community_id, hash_id: job_ref) do
      %Job{} = job -> {:ok, job}
      nil -> {:error, :not_found}
    end
  end

  @doc "Locks one community Job for a staging, failure, cancel, or apply transaction."
  @spec lock_job(pos_integer(), Ecto.UUID.t()) :: {:ok, Job.t()} | {:error, :not_found}
  def lock_job(community_id, job_ref) do
    case Repo.one(
           from(job in Job,
             where: job.community_id == ^community_id and job.hash_id == ^job_ref,
             lock: "FOR UPDATE"
           )
         ) do
      %Job{} = job -> {:ok, job}
      nil -> {:error, :not_found}
    end
  end

  @doc "Marks an unfinished Job failed while preserving completed and cancelled terminal facts."
  @spec fail(Community.t(), Ecto.UUID.t(), String.t(), String.t()) ::
          {:ok, map()} | {:error, term()}
  def fail(%Community{} = community, job_ref, code, message)
      when is_binary(code) and is_binary(message) do
    Repo.transaction(fn ->
      with {:ok, job} <- lock_job(community.id, job_ref) do
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
      else
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
  end

  @doc "Cancels an unfinished ImportJob and removes its staged BodyBags."
  @spec cancel(Community.t(), Ecto.UUID.t()) :: {:ok, map()} | {:error, term()}
  def cancel(%Community{} = community, job_ref) do
    Repo.transaction(fn ->
      with {:ok, job} <- lock_job(community.id, job_ref) do
        if job.status == :completed do
          project(job)
        else
          Repo.delete_all(from(body in StagedBody, where: body.job_id == ^job.id))

          job
          |> Job.changeset(%{
            error_code: nil,
            error_message: nil,
            status: :cancelled
          })
          |> Repo.update!()
          |> project()
        end
      else
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
  end

  @doc "Projects persisted Job facts into the stable API contract, including process state."
  @spec project(Job.t()) :: map()
  def project(%Job{} = job) do
    result = job.result || %{}

    %{
      bad_smells: job.bad_smells || [],
      counts: project_counts(result["counts"] || job.counts || %{}),
      error_code: job.error_code,
      error_message: job.error_message,
      failed_items: result["failedItems"] || [],
      first_imported_doc_ref: result["firstImportedDocRef"],
      job_ref: job.hash_id,
      process: Process.project(job),
      target_branch: result["targetBranch"] || Branch.main_slug(),
      progress: job.progress || %{},
      skipped: result["skipped"] || [],
      source_info: project_source_info(job.source_info),
      status: job.status,
      tree: result["tree"] || job.target_tree
    }
  end

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
    targets = Validator.page_targets(target_tree)

    documents
    |> Enum.reduce_while({:ok, [], MapSet.new()}, fn document, {:ok, items, refs} ->
      external_ref = value(document, "source_ref")
      target = Map.get(targets, external_ref)
      source_hash = value(document, "content_hash")

      cond do
        not is_binary(external_ref) or external_ref == "" ->
          {:halt, {:error, {:custom, "sourceRef is required"}}}

        MapSet.member?(refs, external_ref) ->
          {:halt, {:error, {:custom, "source documents contain a duplicate sourceRef"}}}

        not is_map(target) ->
          {:halt, {:error, {:custom, "source document is missing from confirmed TargetTree"}}}

        not is_binary(source_hash) or
            not String.match?(source_hash, ~r/\Asource-md-v1:[0-9a-f]{64}\z/) ->
          {:halt, {:error, {:custom, "source document hash contract is invalid"}}}

        true ->
          item = %{
            content_status: :pending,
            external_ref: external_ref,
            metadata: %{
              "sizeBytes" => value(document, "size_bytes"),
              "sourcePath" => value(document, "source_path")
            },
            route: value(document, "route"),
            selected: true,
            slug: target["slug"],
            source_hash: source_hash,
            source_revision: value(source_info, "commit"),
            source_version: "source-md-v1",
            target_ref: target["docId"],
            title: value(document, "title")
          }

          {:cont, {:ok, [item | items], MapSet.put(refs, external_ref)}}
      end
    end)
    |> case do
      {:ok, [], _refs} -> {:error, {:custom, "Select at least one document to import"}}
      {:ok, items, _refs} -> {:ok, Enum.reverse(items)}
      error -> error
    end
  end

  defp build_item_attrs(_documents, _target_tree, _source_info),
    do: {:error, {:custom, "source documents must be a list"}}

  defp insert_items(job, attrs) do
    Enum.reduce_while(attrs, :ok, fn attrs, :ok ->
      case %Item{} |> Item.changeset(Map.put(attrs, :job_id, job.id)) |> Repo.insert() do
        {:ok, _item} -> {:cont, :ok}
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
              nil -> {:error, :content_import_connection_create_failed}
            end
        end
    end
  end

  defp assert_same_job(job, input, source_info, item_attrs) do
    persisted_items =
      Item
      |> where([item], item.job_id == ^job.id)
      |> select([item], {item.external_ref, item.target_ref, item.source_hash})
      |> Repo.all()
      |> Enum.sort()

    requested_items =
      item_attrs
      |> Enum.map(&{&1.external_ref, &1.target_ref, &1.source_hash})
      |> Enum.sort()

    same? =
      job.dataset_ref == Map.fetch!(input, :dataset_ref) and
        job.source_info == source_info and
        job.target_revision == Map.fetch!(input, :target_revision) and
        job.target_tree == Map.fetch!(input, :target_tree) and
        persisted_items == requested_items

    if same?, do: :ok, else: {:error, {:custom, "previewRef is already bound to another intent"}}
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
