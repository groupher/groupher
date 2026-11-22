defmodule GroupherServer.CMS.DocTree.Publish.Queue.Merge do
  @moduledoc """
  Absorbs a locked default Doc revision into its independent Queue copy.

      admitted Docs command -> site and content locks -> three-way merge -> Queue content + baseline

  The caller owns authorization, Lifecycle, Receipt, effects and rollback on
  error. The selected content must never come from external merge input.
  """

  alias GroupherServer.{Accounts, CMS, Repo}
  alias Accounts.Model.User
  alias CMS.Articles.WorkingCopy.{Snapshotter, Store}
  alias CMS.DocTree.Publish.{ContentMerge, ContentState, Queue}
  alias CMS.DocTree.Publish.Queue.Save
  alias CMS.Model.{Community, DocsPublishQueue, DocsQueueArticle}

  @fields ~w(title digest slug subtitle link_addr template_key cover_url cover_url_dark cover_edit)a

  @doc "Merges one checked default revision into a checked Queue member in the caller transaction."
  def merge(
        %Community{} = community,
        %DocsPublishQueue{} = queue,
        queue_revision,
        article_id,
        default_revision,
        work_revision,
        choices,
        %User{id: actor_id} = actor,
        command_id,
        operation_ref
      )
      when is_integer(queue_revision) and queue_revision >= 0 and is_binary(article_id) and
             is_integer(default_revision) and default_revision > 0 and is_integer(work_revision) and
             work_revision > 0 and is_map(choices) and is_integer(actor_id) and actor_id > 0 and
             is_binary(command_id) do
    with {:ok, article_id} <- Ecto.UUID.cast(article_id),
         {:ok, command_id} <- Ecto.UUID.cast(command_id),
         {:ok, queue} <- Queue.advance(community, queue, %{queue_revision: queue_revision}, []),
         %User{} <- Repo.get(User, actor_id),
         {:ok, locked} <- Save.lock_member(community, queue, article_id, work_revision),
         {:ok, :pass} <- check_default(locked.default, default_revision),
         {:ok, source} <-
           Snapshotter.freeze_locked(locked.article, locked.default, actor, command_id),
         {:ok, base_content} <- ContentState.load(locked.source),
         {:ok, source_content} <- ContentState.load(source),
         {:ok, target_content} <- ContentState.load(locked.work),
         {:ok, selected} <-
           merge_content(base_content, source_content, target_content, choices, queue, locked),
         {:ok, changed} <-
           ContentMerge.exclusive_changes(target_content, selected.fields, target_content),
         {:ok, saved} <- save_selected(locked.work, source, selected, changed, actor, community),
         {:ok, member} <- update_source(locked.member, source.id),
         {:ok, updated_queue} <-
           advance_if_changed(
             community,
             queue,
             queue_revision,
             article_id,
             actor,
             changed,
             operation_ref
           ) do
      {:ok, %{queue: updated_queue, member: member, working_copy: saved, changed_fields: changed}}
    else
      :error -> {:error, :invalid_queue_merge}
      nil -> {:error, :invalid_queue_actor}
      {:error, _reason} = error -> error
    end
  end

  def merge(_, _, _, _, _, _, _, _, _, _), do: {:error, :invalid_queue_merge}

  defp check_default(%{revision: revision}, revision), do: {:ok, :pass}

  defp check_default(%{article_id: id, revision: actual}, _revision) do
    {:error, {:default_revision_conflict, id, actual}}
  end

  defp merge_content(base, source, target, choices, queue, locked) do
    case ContentMerge.merge(base, source, target, choices: choices) do
      {:error, {:merge_conflict, fields}} ->
        {:error,
         {:merge_conflict,
          %{
            fields: fields,
            queue_revision: queue.queue_revision,
            default_revision: locked.default.revision,
            working_copy_revision: locked.work.revision
          }}}

      result ->
        result
    end
  end

  defp save_selected(work, _source, _selected, [], _actor, _community), do: {:ok, work}

  defp save_selected(work, source, selected, _changed, actor, community) do
    attrs =
      selected.fields
      |> Map.take(@fields)
      |> Map.put(:tag_ids, selected.fields.tags)
      |> Map.put(:asset_refs, selected.fields.asset_refs)

    body_source = if selected.origins.body == :source, do: source, else: work

    Store.save_merged_loaded(
      work,
      body_source,
      attrs,
      selected.fields.cover_refs,
      actor,
      work.revision,
      community.id
    )
  end

  defp update_source(%DocsQueueArticle{source_snapshot_id: id} = member, id), do: {:ok, member}

  defp update_source(member, id) do
    member |> DocsQueueArticle.changeset(%{source_snapshot_id: id}) |> Repo.update()
  end

  defp advance_if_changed(_community, queue, _revision, _article_id, _actor, [], _operation_ref) do
    {:ok, queue}
  end

  defp advance_if_changed(community, queue, revision, article_id, actor, _changed, operation_ref) do
    with {:ok, _} <- Queue.record_contribution(community, queue, revision, article_id, actor),
         {:ok, queue} <-
           Queue.advance(
             community,
             queue,
             %{queue_revision: revision},
             [:queue_revision],
             operation_ref
           ) do
      {:ok, queue}
    end
  end
end
