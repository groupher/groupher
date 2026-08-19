defmodule GroupherServer.CMS.ContentImport.Threads.Doc.Writer do
  @moduledoc """
  Atomically writes imported Docs, source mappings, and ImportJob completion.

      ready Job
         |
         v
      DB transaction -> lock Job/items/bodies -> revalidate target intent
                                                |
                                                v
      global DocTree lock -> restore mapped trash -> write drafts + tree
                                                |
                                                v
                         upsert mappings -> delete staging -> complete Job

  Any failure rolls back Docs, tree, mappings, staged-body deletion, and Job
  completion together. Retrying a completed Job returns its persisted result.

  See `docs/bulk-import/article-publish-import-refactor.md` and
  `docs/bulk-import/content-import-architecture.md`.
  """

  import Ecto.Query, warn: false

  alias GroupherServer.{CMS, Repo}
  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS.Articles.Draft
  alias GroupherServer.CMS.Docs.{Branch, Lifecycle}
  alias GroupherServer.CMS.ContentImport.{ImportSourceMapping, Jobs}
  alias GroupherServer.CMS.ContentImport.Persistence.Job
  alias GroupherServer.CMS.ContentImport.Persistence.Job.Body, as: StagedBody
  alias GroupherServer.CMS.ContentImport.Persistence.Job.Item
  alias GroupherServer.CMS.ContentImport.Threads.Doc.Validator
  alias GroupherServer.CMS.ErrorCat
  alias GroupherServer.CMS.DocTree
  alias GroupherServer.CMS.DocTree.Import, as: DocTreeImport
  alias GroupherServer.CMS.DocTree.Reader, as: DocTreeReader
  alias GroupherServer.CMS.Model.{Community, TrashAction, TrashedDocArticle}
  alias Helper.Transaction

  require CMS.Const

  @doc "Atomically applies all ready items for one community Job."
  @spec apply(Community.t(), Ecto.UUID.t()) :: {:ok, map()} | {:error, term()}
  def apply(%Community{} = community, job_ref) do
    Repo.transaction(fn ->
      with {:ok, job} <- Jobs.lock_job(community.id, job_ref) do
        if job.status == :completed do
          Jobs.project(job)
        else
          apply_locked(community, job)
        end
      else
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
  end

  defp apply_locked(community, %Job{status: :ready} = job) do
    with %User{} = actor <- Repo.get(User, job.actor_id),
         {:ok, branch} <- Branch.resolve(community, Branch.main_slug()) do
      case Transaction.lock_global("doc_tree:#{community.id}:#{branch.id}", fn ->
             apply_to_main_draft(community, branch, actor, job)
           end) do
        {:ok, result} -> result
        {:error, reason} -> Repo.rollback(reason)
      end
    else
      nil -> Repo.rollback(ErrorCat.content_import_actor_not_found())
      {:error, reason} -> Repo.rollback(reason)
      reason -> Repo.rollback(reason)
    end
  end

  defp apply_locked(_community, job),
    do: Repo.rollback(ErrorCat.content_import_job_not_ready(job.status))

  defp apply_to_main_draft(community, branch, actor, job) do
    with :ok <-
           Validator.validate_intent(
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
         tree <- Validator.filter_target_tree(job.target_tree, ready_refs),
         :ok <- restore_trashed_targets(community, branch, actor, ready_items),
         {:ok, target_states} <- load_target_states(community, branch, ready_items),
         {:ok, written_items} <-
           write_items(community, branch, actor, ready_items, bodies, target_states),
         {:ok, _tree} <- DocTreeImport.apply(community, branch, tree, written_items),
         :ok <- upsert_mappings(job, ready_items, bodies),
         result <- build_result(job, items, tree, ready_items),
         {_count, nil} <- Repo.delete_all(from(body in StagedBody, where: body.job_id == ^job.id)),
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
      false -> {:error, ErrorCat.content_import_has_no_ready_documents()}
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
      StagedBody
      |> where([body], body.job_id == ^job_id)
      |> lock("FOR UPDATE")
      |> Repo.all()
      |> Map.new(&{&1.external_ref, &1})

    missing = Enum.find(ready_items, &(not Map.has_key?(bodies, &1.external_ref)))
    if missing, do: {:error, ErrorCat.content_import_staged_body_missing()}, else: {:ok, bodies}
  end

  # Source mappings are the stable identity of an imported Doc. A Docs Tree
  # delete keeps the physical Article rows but hides them behind one grouped
  # Trash action, so active Draft reads cannot distinguish that state from a
  # genuinely missing Doc. Restore the owning action before source-wins writes
  # reuse the mapped article_hash_id.
  defp restore_trashed_targets(community, branch, actor, ready_items) do
    ready_items
    |> Enum.map(& &1.target_ref)
    |> trashed_action_refs(community, branch)
    |> Enum.reduce_while(:ok, fn action_ref, :ok ->
      with {:ok, state} <- DocTreeReader.ensure_draft_state(community, branch_id: branch.id),
           {:ok, %{conflict: false}} <-
             DocTree.restore_trash_item(community, action_ref, %{
               actor_id: actor.id,
               base_revision: state.tree_lock_version,
               branch_id: branch.id
             }) do
        {:cont, :ok}
      else
        {:ok, %{conflict: true}} ->
          {:halt,
           {:error, GroupherServer.ErrorCat.custom("The Docs Trash changed during import")}}

        {:error, reason} ->
          {:halt, {:error, reason}}
      end
    end)
  end

  defp trashed_action_refs(target_refs, community, branch) do
    TrashedDocArticle
    |> join(:inner, [item], action in TrashAction, on: action.id == item.trash_action_id)
    |> where(
      [item, action],
      item.community_id == ^community.id and
        item.branch_id == ^branch.id and
        item.article_hash_id in ^target_refs and action.community_id == ^community.id
    )
    |> order_by([_item, action], asc: action.id)
    |> select([_item, action], action.hash_id)
    |> Repo.all()
    |> Enum.uniq()
  end

  defp load_target_states(community, branch, items) do
    target_refs = items |> Enum.map(& &1.target_ref) |> Enum.uniq()

    with {:ok, %{model: model}} <- CMS.Artiment.Matcher.match(:doc) do
      draft_refs =
        target_refs
        |> target_refs_by_stage(model, community, branch, CMS.Const.stage(:draft))
        |> MapSet.new()

      public_refs =
        target_refs
        |> target_refs_by_stage(model, community, branch, CMS.Const.stage(:public))
        |> MapSet.new()

      states =
        Map.new(target_refs, fn target_ref ->
          state =
            cond do
              MapSet.member?(draft_refs, target_ref) -> :draft
              MapSet.member?(public_refs, target_ref) -> :public
              true -> :missing
            end

          {target_ref, state}
        end)

      {:ok, states}
    end
  end

  defp target_refs_by_stage(target_refs, model, community, branch, stage) do
    model
    |> CMS.Articles.Trash.not_trashed_scope(:doc)
    |> where([article], article.article_hash_id in ^target_refs)
    |> where([article], article.community_id == ^community.id)
    |> where([article], article.branch_id == ^branch.id)
    |> where([article], article.stage == ^stage)
    |> select([article], article.article_hash_id)
    |> Repo.all()
  end

  defp write_items(community, branch, actor, items, bodies, target_states) do
    Enum.reduce_while(items, {:ok, %{}}, fn item, {:ok, written} ->
      body = Map.fetch!(bodies, item.external_ref)

      attrs = %{
        article_hash_id: item.target_ref,
        body_bag: body.body_bag,
        branch_id: branch.id,
        slug: item.slug,
        title: item.title
      }

      case write_item(
             community,
             item.target_ref,
             attrs,
             actor,
             branch,
             Map.fetch!(target_states, item.target_ref)
           ) do
        {:ok, _draft} -> {:cont, {:ok, Map.put(written, item.target_ref, item)}}
        {:error, reason} -> {:halt, {:error, reason}}
      end
    end)
  end

  defp write_item(community, target_ref, attrs, actor, branch, state) do
    with {:ok, _lifecycle} <- Lifecycle.ensure_created(community.id, branch.id, target_ref) do
      do_write_item(community, target_ref, attrs, actor, branch, state)
    end
  end

  defp do_write_item(community, target_ref, attrs, _actor, branch, :draft) do
    with {:ok, draft} <- Draft.read(community, :doc, target_ref, branch) do
      Draft.update(community, :doc, target_ref, Map.put(attrs, :expected_version, draft.version))
    end
  end

  defp do_write_item(community, target_ref, attrs, actor, branch, :public) do
    with {:ok, editor} <- Draft.read_editor(community, :doc, target_ref, branch) do
      Draft.update_or_create_from_public(
        community,
        :doc,
        target_ref,
        Map.put(attrs, :expected_version, editor.version),
        actor
      )
    end
  end

  defp do_write_item(community, _target_ref, attrs, actor, _branch, :missing),
    do: Draft.create(community, :doc, attrs, actor)

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
      "firstImportedDocRef" => first_item && first_item.target_ref,
      "targetBranch" => Branch.main_slug(),
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
