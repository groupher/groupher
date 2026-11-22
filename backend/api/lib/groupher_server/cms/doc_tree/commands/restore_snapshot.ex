defmodule GroupherServer.CMS.DocTree.Commands.RestoreSnapshot do
  @moduledoc """
  Restores one authorized historical Snapshot into D without publishing it.

      history + edit Gate -> site / Article / D locks -> preserve old D Snapshot -> copy selected content

  Existing D identity and revision must match. An absent D gets a fresh ID;
  history reads and Receipt replay never create a copy implicitly.
  """
  use GroupherServer.CommandPipeline, adapter: GroupherServer.CMS.CommandPipelineAdapter
  import Ecto.Query
  alias GroupherServer.{CMS, Repo}
  alias CMS.DocTree.{DefaultCopy, Publish}
  alias CMS.DocTree.Commands.{QueueAccess, RestoreSnapshotConfirmation}
  alias CMS.Articles.WorkingCopy.{Snapshotter, Store}
  alias CMS.Model.ArticleSnapshot

  @pipeline operation: :docs_restore_snapshot,
            confirmation: RestoreSnapshotConfirmation,
            target: :community,
            params: [:article_id, :snapshot_id, :working_copy_id, :revision]
  receipt_pipeline run_receipt(
                     community,
                     article_id,
                     snapshot_id,
                     working_copy_id,
                     revision,
                     actor,
                     command_id
                   ) do
    gate(fn canonical -> CMS.Gate.check_in_transaction(actor, :docs_history_read, canonical) end)

    change(fn canonical, _operation_ref ->
      with {:ok, :acquired} <- Publish.SiteLock.acquire(canonical),
           {:ok, :pass} <- QueueAccess.authorize(canonical, article_id, actor),
           {:ok, state} <- DefaultCopy.load(canonical, article_id),
           true <- state.lifecycle.state in [:draft, :published],
           {:ok, context} <- CMS.Gate.Access.Load.community(actor, canonical),
           visible <- CMS.Gate.Scope.DocsContent.query(actor, context, :history),
           true <- Repo.exists?(from(a in visible, where: a.id == ^article_id)),
           %ArticleSnapshot{article_id: ^article_id} = snapshot <-
             Repo.get(ArticleSnapshot, snapshot_id),
           {:ok, work} <-
             restore(state, snapshot, working_copy_id, revision, actor, command_id, canonical.id) do
        {:ok, work}
      else
        {:error, _} = error -> error
        _ -> {:error, :docs_publication_unavailable}
      end
    end)

    confirm(fn work ->
      {:ok,
       %RestoreSnapshotConfirmation{
         data: %{
           "community_id" => community.id,
           "article_id" => article_id,
           "working_copy_id" => work.id,
           "revision" => work.revision
         }
       }}
    end)

    present(fn confirmation ->
      with {:ok, _} <- CMS.Gate.access_check(actor, :docs_history_read, community),
           {:ok, :pass} <- QueueAccess.authorize_after_commit(community, article_id, actor) do
        {:ok,
         %{
           working_copy_id: confirmation.data["working_copy_id"],
           revision: confirmation.data["revision"]
         }}
      end
    end)
  end

  @doc "Restores into the explicitly selected editing session, preserving previous saved content."
  def execute(site, article_id, snapshot_id, work_id, revision, actor, command) do
    with {:ok, article_id} <- Ecto.UUID.cast(article_id),
         {:ok, snapshot_id} <- Ecto.UUID.cast(snapshot_id) do
      run_receipt(site, article_id, snapshot_id, work_id, revision, actor, command)
    else
      _ -> {:error, :docs_publication_unavailable}
    end
  end

  defp restore(%{work: nil}, snapshot, nil, nil, actor, _command, _site_id) do
    Snapshotter.fork_snapshot_in_transaction(
      snapshot.id,
      %{
        article_id: snapshot.article_id,
        scope_type: :default,
        scope_id: snapshot.article_id
      },
      actor
    )
  end

  defp restore(
         %{work: %{id: id, revision: revision} = work},
         snapshot,
         id,
         revision,
         actor,
         command,
         site_id
       ) do
    with {:ok, _preserved} <- Snapshotter.freeze_in_transaction(id, revision, actor, command),
         {:ok, content} <- Publish.ContentState.load(snapshot) do
      attrs =
        content
        |> Map.take(
          ~w(title digest slug subtitle link_addr template_key cover_url cover_url_dark cover_edit)a
        )
        |> Map.put(:tag_ids, content.tags)
        |> Map.put(:asset_refs, content.asset_refs)

      Store.save_merged_loaded(
        work,
        snapshot,
        attrs,
        content.cover_refs,
        actor,
        revision,
        site_id
      )
    end
  end

  defp restore(_, _, _, _, _, _, _), do: {:error, :docs_preview_changed}
end
