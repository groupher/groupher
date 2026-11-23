defmodule GroupherServer.CMS.DocTree.Workflows.Import do
  @moduledoc """
  Atomically writes imported Docs, source mappings, and ImportJob completion.

      ready Job
         |
         v
      DB transaction -> lock Job/items/bodies -> revalidate target intent
                                                |
                                                v
      site lock -> restore mapped trash -> write D + workspace tree
                                                |
                                                v
                         upsert mappings -> delete staging -> complete Job

  Any failure rolls back Docs, tree, mappings, staged-body deletion, and Job
  completion together. Retrying a completed Job returns its persisted result.

  See `docs/import/article-publish-import-refactor.md` and
  `docs/import/import-architecture.md`.
  """

  import Ecto.Query, warn: false

  alias GroupherServer.{Accounts, CMS, Repo}

  alias Accounts.Model.User
  alias CMS.Articles.WorkingCopy.Store

  alias CMS.Import.{
    DocValidator,
    ImportSourceMapping,
    Jobs
  }

  alias CMS.Import.{Model.Job, Model.Job.Item, Transaction}
  alias CMS.Import.Model.Job.Body
  alias CMS.ErrorCat
  alias CMS.DocTree.Import, as: DocTreeImport
  alias CMS.DocTree.{DefaultCopy, WorkspaceRestore}
  alias CMS.DocTree.Publish.{Queue, SiteLock}

  alias CMS.Model.{Article, Community, DocsTrashedArticle, TrashAction}

  @doc "Atomically applies all ready items for one community Job."
  @spec apply(Community.t(), Ecto.UUID.t()) :: {:ok, map()} | {:error, term()}
  def apply(%Community{} = community, job_ref) do
    Transaction.run(fn ->
      case SiteLock.acquire(community) do
        {:ok, :acquired} -> {:ok, :pass}
        {:error, reason} -> Repo.rollback(reason)
      end

      case Jobs.lock_job(community.id, job_ref) do
        {:ok, job} ->
          if job.status == :completed do
            Jobs.project(job)
          else
            apply_locked(community, job)
          end

        {:error, reason} ->
          Repo.rollback(reason)
      end
    end)
  end

  defp apply_locked(community, %Job{status: :ready} = job) do
    with %User{} = actor <- Repo.get(User, job.actor_id),
         {:ok, _community} <-
           CMS.Gate.check_community_workflow_in_transaction(actor, :import_docs, community),
         {:ok, _queue} <- Queue.lock_or_create(community),
         {:ok, result} <- apply_to_workspace(community, actor, job) do
      result
    else
      nil -> Repo.rollback(ErrorCat.import_actor_not_found())
      {:error, reason} -> Repo.rollback(reason)
    end
  end

  defp apply_locked(_community, job) do
    Repo.rollback(ErrorCat.import_job_not_ready(job.status))
  end

  defp apply_to_workspace(community, actor, job) do
    with {:ok, _} <-
           DocValidator.validate_intent(
             community,
             job.source_info,
             job.target_tree,
             job.target_revision
           ),
         {:ok, job} <- job |> Job.changeset(%{status: :applying}) |> Repo.update(),
         items <- lock_items(job.id),
         ready_items <- Enum.filter(items, &(&1.content_status == :ready)),
         true <- ready_items != [],
         {:ok, bodies} <- load_bodies(job.id, ready_items),
         ready_refs <- MapSet.new(ready_items, & &1.external_ref),
         tree <- DocValidator.filter_target_tree(job.target_tree, ready_refs),
         {:ok, _} <- restore_trashed_targets(community, actor, job.hash_id, ready_items),
         {:ok, written_items} <-
           write_items(community, actor, ready_items, bodies),
         {:ok, _tree} <- DocTreeImport.apply(community, tree, written_items, actor, job.hash_id),
         {:ok, _} <- upsert_mappings(job, ready_items, bodies),
         result <- build_result(job, items, tree, ready_items),
         {_count, nil} <- Repo.delete_all(from(body in Body, where: body.job_id == ^job.id)),
         {:ok, completed} <-
           job
           |> Job.changeset(%{
             completed_at: DateTime.utc_now(),
             progress: Map.put(job.progress || %{}, "applied", result["counts"]),
             result: result,
             status: :completed
           })
           |> Repo.update() do
      {:ok, Jobs.project(completed)}
    else
      false -> {:error, ErrorCat.import_has_no_ready_documents()}
      {:error, reason} -> {:error, reason}
      reason -> {:error, reason}
    end
  end

  defp lock_items(job_id) do
    Item
    |> where([item], item.job_id == ^job_id)
    |> order_by([item], asc: item.id)
    |> lock("FOR UPDATE")
    |> Repo.all()
  end

  defp load_bodies(job_id, ready_items) do
    bodies =
      Body
      |> where([body], body.job_id == ^job_id)
      |> lock("FOR UPDATE")
      |> Repo.all()
      |> Map.new(&{&1.external_ref, &1})

    missing = Enum.find(ready_items, &(not Map.has_key?(bodies, &1.external_ref)))
    if missing, do: {:error, ErrorCat.import_staged_body_missing()}, else: {:ok, bodies}
  end

  # Reimport restores the complete owning Trash action before writing its D.
  # The new restore path rechecks permissions and Queue dependencies atomically.
  defp restore_trashed_targets(community, actor, _operation_ref, items) do
    ids = Enum.map(items, & &1.target_ref)

    actions =
      Repo.all(
        from(d in DocsTrashedArticle,
          join: a in TrashAction,
          on: a.id == d.trash_action_id,
          where:
            d.community_id == ^community.id and d.article_id in ^ids and
              a.community_id == ^community.id,
          order_by: a.id,
          select: a.hash_id
        )
      )
      |> Enum.uniq()

    actions
    |> Enum.with_index()
    |> Enum.reduce_while({:ok, :pass}, fn {id, operation_index}, _ ->
      with {:ok, queue} <- Queue.lock_or_create(community),
           {:ok, restored} <-
             WorkspaceRestore.run(
               community,
               queue,
               queue.tree_lock_version,
               queue.queue_revision,
               id,
               :restore_original,
               nil,
               actor,
               id
             ),
           {:ok, _} <-
             GroupherServer.Activity.log(
               %{activity_type: :doc_tree, community_id: community.id, ref: restored.node_id},
               :restored,
               actor: actor,
               source: :worker,
               operation_ref: id,
               operation_index: operation_index
             ) do
        {:cont, {:ok, :pass}}
      else
        {:error, _} = error -> {:halt, error}
      end
    end)
  end

  defp write_items(community, actor, items, bodies) do
    items
    |> Enum.sort_by(& &1.target_ref)
    |> Enum.reduce_while({:ok, %{}}, fn item, {:ok, written} ->
      body = Map.fetch!(bodies, item.external_ref)

      attrs = %{
        article_id: item.target_ref,
        body_bag: body.body_bag,
        slug: item.slug,
        title: item.title
      }

      case write_item(community, item.target_ref, attrs, actor) do
        {:ok, _} -> {:cont, {:ok, Map.put(written, item.target_ref, item)}}
        {:error, _} = error -> {:halt, error}
      end
    end)
  end

  defp write_item(community, id, attrs, actor) do
    case Repo.get(Article, id) do
      nil ->
        CMS.Docs.Content.create_workspace(community, attrs, actor)

      %Article{thread: :doc} ->
        with {:ok, :pass} <- CMS.DocTree.Commands.QueueAccess.authorize(community, id, actor),
             {:ok, state} <- DefaultCopy.load(community, id),
             true <- state.lifecycle.state in [:draft, :published],
             {:ok, copy} <- editable_copy(community, state, actor),
             {:ok, saved} <- Store.save_loaded(copy, attrs, actor, copy.revision, community.id) do
          {:ok, saved}
        else
          false -> {:error, :invalid_doc_lifecycle}
          {:error, _} = error -> error
        end

      _ ->
        {:error, :invalid_doc_identity}
    end
  end

  defp editable_copy(_community, %{work: %{} = copy}, _actor), do: {:ok, copy}

  defp editable_copy(community, %{article: article, public: public}, actor) do
    DefaultCopy.ensure(community, article.id, public.snapshot_id, actor)
  end

  defp upsert_mappings(job, items, bodies) do
    now = DateTime.utc_now() |> DateTime.truncate(:second)

    attrs =
      Enum.map(items, fn item ->
        body = Map.fetch!(bodies, item.external_ref)

        %{
          connection_id: job.connection_id,
          external_ref: item.external_ref,
          groupher_hash: ImportSourceMapping.groupher_hash(body.body_hash, item.title, item.slug),
          last_checked_at: now,
          last_imported_at: now,
          source_hash: item.source_hash,
          source_revision: item.source_revision,
          source_updated_at: item.source_updated_at,
          source_version: item.source_version,
          thread: :doc,
          thread_ref: item.target_ref
        }
      end)

    ImportSourceMapping.upsert_all(attrs)
  end

  defp build_result(job, items, tree, ready_items) do
    tabs = tree["tabs"] || []
    nodes = Enum.flat_map(tabs, &collect_target_nodes(&1["groups"] || []))
    first_item = List.first(ready_items)

    %{
      "counts" => %{
        "assets" => 0,
        "groups" => Enum.count(nodes, &(&1["type"] == "group")),
        "links" => Enum.count(nodes, &(&1["type"] == "link")),
        "pages" => length(ready_items),
        "tabs" => length(tabs)
      },
      "firstImportedDocId" => first_item && first_item.target_ref,
      "failedItems" =>
        items
        |> Enum.filter(&(&1.content_status == :failed))
        |> Enum.map(&failure_result/1),
      "skipped" =>
        items
        |> Enum.filter(&(&1.content_status == :skipped))
        |> Enum.map(&skip_result/1),
      "sourceRevision" => job.source_info["commit"],
      "tree" => tree
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

  defp failure_result(item) do
    %{
      "code" => item.error_code,
      "externalRef" => item.external_ref,
      "message" => item.error_message,
      "stage" => item.error_stage
    }
  end

  defp skip_result(item) do
    %{
      "code" => item.skip_code,
      "externalRef" => item.external_ref,
      "message" => "Document exceeds the import capacity limit.",
      "stage" => "validation"
    }
  end
end
