defmodule GroupherServer.CMS.DocTree.HistoryPurge do
  @moduledoc """
  Removes the Docs aggregate only as part of a Community destroy transaction.

      locked Community destroy -> site lock -> Queue / Release / approvals
        -> navigation / Trash -> Article versions and bodies -> stable identities

  Individual Doc deletion never calls this workflow. Shared assets and other
  Communities' content are not deleted. Foreign keys reject unexpected references.
  """
  alias GroupherServer.{CMS, Repo, AlertWall}
  alias CMS.Model.{Community, CommunityLifecycle}
  alias CMS.DocTree.Publish.SiteLock

  @doc "Purges community-owned Docs history after the locked destroy transition."
  def run(%CommunityLifecycle{state: :destroy, community_id: id}, operation_ref) do
    if Repo.in_transaction?() do
      with {:ok, :acquired} <- SiteLock.acquire(%Community{id: id}) do
        purge(id, operation_ref)
      end
    else
      {:error, :transaction_required}
    end
  end

  def run(_, _), do: {:error, :community_destroy_required}

  defp purge(id, operation_ref) do
    rows =
      Repo.query!(
        "SELECT article_id FROM cms.docs_history_owners WHERE community_id=$1 ORDER BY article_id FOR UPDATE",
        [id]
      ).rows

    ids = Enum.map(rows, &hd/1)

    Enum.each(ids, fn raw_id ->
      article_id = Ecto.UUID.load!(raw_id)

      case AlertWall.mark_target_deleted_in_transaction(:doc, article_id, operation_ref) do
        {:ok, _} -> {:ok, :pass}
        {:error, reason} -> Repo.rollback(reason)
      end
    end)

    Repo.query!(
      "UPDATE cms.docs_publish_queues SET latest_approval_id=NULL, public_release_id=NULL WHERE community_id=$1",
      [id]
    )

    Repo.query!(
      "DELETE FROM cms.docs_queue_articles WHERE queue_id IN (SELECT id FROM cms.docs_publish_queues WHERE community_id=$1)",
      [id]
    )

    delete_community("docs_queue_tree_changes", id)
    delete_community("docs_post_publish_conflicts", id)
    delete_community("docs_publication_notifications", id)
    delete_community("trashed_doc_tree_nodes", id)
    delete_community("trashed_doc_articles", id)

    Repo.query!(
      "DELETE FROM cms.trash_actions WHERE community_id=$1 AND root_type='doc_tree_node'",
      [id]
    )

    delete_community("doc_tree_nodes", id)
    purge_release_history(id)
    delete_community("docs_publish_queues", id)
    delete_community("doc_tree_snapshots", id)
    purge_tree_events(id)

    cover_work =
      Repo.query!(
        "SELECT cover_edit_working_copy_id FROM cms.article_working_copies WHERE article_id=ANY($1::uuid[]) AND cover_edit_working_copy_id IS NOT NULL",
        [ids]
      ).rows
      |> Enum.map(&hd/1)

    cover_snapshot =
      Repo.query!(
        "SELECT cover_edit_snapshot_id FROM cms.article_snapshots WHERE article_id=ANY($1::uuid[]) AND cover_edit_snapshot_id IS NOT NULL",
        [ids]
      ).rows
      |> Enum.map(&hd/1)

    delete_community("doc_lifecycles", id)
    Repo.query!("DELETE FROM cms.article_publics WHERE article_id=ANY($1::uuid[])", [ids])

    Repo.query!(
      "DELETE FROM cms.article_asset_refs WHERE working_copy_id IN (SELECT id FROM cms.article_working_copies WHERE article_id=ANY($1::uuid[])) OR snapshot_id IN (SELECT id FROM cms.article_snapshots WHERE article_id=ANY($1::uuid[]))",
      [ids]
    )

    Repo.query!("DELETE FROM cms.article_working_copies WHERE article_id=ANY($1::uuid[])", [ids])
    Repo.query!("DELETE FROM cms.article_snapshots WHERE article_id=ANY($1::uuid[])", [ids])

    Repo.query!(
      "DELETE FROM cms.cover_edit_working_copies WHERE id=ANY($1::uuid[]) AND NOT EXISTS (SELECT 1 FROM cms.article_working_copies w WHERE w.cover_edit_working_copy_id=cover_edit_working_copies.id)",
      [cover_work]
    )

    Repo.query!(
      "DELETE FROM cms.cover_edit_snapshots WHERE id=ANY($1::uuid[]) AND NOT EXISTS (SELECT 1 FROM cms.article_snapshots s WHERE s.cover_edit_snapshot_id=cover_edit_snapshots.id)",
      [cover_snapshot]
    )

    Repo.query!("DELETE FROM account.collect_folder_entries WHERE article_id=ANY($1::uuid[])", [
      ids
    ])

    delete_community("docs_history_owners", id)
    Repo.query!("DELETE FROM cms.articles WHERE id=ANY($1::uuid[]) AND thread='doc'", [ids])
    {:ok, :purged}
  end

  defp purge_release_history(id) do
    approvals =
      Repo.query!(
        "DELETE FROM cms.docs_publish_approvals a WHERE community_id=$1 AND NOT EXISTS (SELECT 1 FROM cms.doc_publish_releases r WHERE r.approval_id=a.id)",
        [id]
      ).num_rows

    releases =
      Repo.query!(
        "DELETE FROM cms.doc_publish_releases r WHERE community_id=$1 AND NOT EXISTS (SELECT 1 FROM cms.doc_publish_releases child WHERE child.base_release_id=r.id) AND NOT EXISTS (SELECT 1 FROM cms.docs_publish_approvals a WHERE a.base_release_id=r.id)",
        [id]
      ).num_rows

    [[remaining]] =
      Repo.query!(
        "SELECT (SELECT count(*) FROM cms.docs_publish_approvals WHERE community_id=$1)+(SELECT count(*) FROM cms.doc_publish_releases WHERE community_id=$1)",
        [id]
      ).rows

    cond do
      remaining == 0 -> {:ok, :purged}
      approvals + releases > 0 -> purge_release_history(id)
      true -> Repo.rollback(:docs_history_dependency_cycle)
    end
  end

  defp purge_tree_events(id) do
    count =
      Repo.query!(
        "DELETE FROM cms.doc_tree_events e WHERE community_id=$1 AND NOT EXISTS (SELECT 1 FROM cms.doc_tree_events child WHERE child.reverts_event_id=e.id)",
        [id]
      ).num_rows

    [[remaining]] =
      Repo.query!("SELECT count(*) FROM cms.doc_tree_events WHERE community_id=$1", [id]).rows

    cond do
      remaining == 0 -> {:ok, :purged}
      count > 0 -> purge_tree_events(id)
      true -> Repo.rollback(:docs_tree_history_dependency_cycle)
    end
  end

  defp delete_community(table, id) do
    Repo.query!("DELETE FROM cms.#{table} WHERE community_id=$1", [id])
    {:ok, :deleted}
  end
end
