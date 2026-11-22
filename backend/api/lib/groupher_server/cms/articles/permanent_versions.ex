defmodule GroupherServer.CMS.Articles.PermanentVersions do
  @moduledoc """
  Removes the Article-owned immutable version aggregate in an admitted global purge.

      global purge transaction -> protected-reference check -> events -> version children -> snapshots / bodies

  The caller owns Gate authorization, all site and Article locks, public / workspace removal,
  the operation audit and rollback. This helper never deletes shared assets or the Article.
  """

  import Ecto.Query
  alias GroupherServer.{CMS, Repo}

  alias CMS.Model.{
    Article,
    ArticleAssetRef,
    ArticleBody,
    ArticleEvent,
    ArticleHistoryOwner,
    ArticleLifecycle,
    ArticlePublic,
    ArticleSnapshot,
    ArticleSnapshotPost,
    ArticleSnapshotBlog,
    ArticleSnapshotChangelog,
    ArticleSnapshotDoc,
    ArticleSnapshotTag,
    CoverEditSnapshot
  }

  @doc false
  def purge_in_transaction(%Article{id: article_id} = article, community_id) do
    with true <- Repo.in_transaction?(),
         %ArticleLifecycle{state: :destroy} <-
           Repo.get_by(ArticleLifecycle, article_id: article_id),
         {:ok, :pass} <- CMS.Articles.RetainedHistory.ensure_unprotected(article, community_id),
         false <- Repo.exists?(from(p in ArticlePublic, where: p.article_id == ^article_id)) do
      snapshots =
        Repo.all(
          from(s in ArticleSnapshot,
            where: s.article_id == ^article_id,
            order_by: s.id,
            lock: "FOR UPDATE",
            select: {s.id, s.body_id, s.cover_edit_snapshot_id}
          )
        )

      ids = Enum.map(snapshots, &elem(&1, 0))
      bodies = Enum.map(snapshots, &elem(&1, 1))
      covers = snapshots |> Enum.map(&elem(&1, 2)) |> Enum.reject(&is_nil/1)

      Repo.delete_all(from(e in ArticleEvent, where: e.article_id == ^article_id))
      Repo.delete_all(from(r in ArticleAssetRef, where: r.snapshot_id in ^ids))

      for model <- [
            ArticleSnapshotTag,
            ArticleSnapshotPost,
            ArticleSnapshotBlog,
            ArticleSnapshotChangelog,
            ArticleSnapshotDoc
          ] do
        Repo.delete_all(from(child in model, where: child.snapshot_id in ^ids))
      end

      Repo.delete_all(from(s in ArticleSnapshot, where: s.id in ^ids))
      Repo.delete_all(from(b in ArticleBody, where: b.id in ^bodies))
      Repo.delete_all(from(c in CoverEditSnapshot, where: c.id in ^covers))

      Repo.delete_all(
        from(o in ArticleHistoryOwner,
          where: o.article_id == ^article_id and o.community_id == ^community_id
        )
      )

      {:ok, :purged}
    else
      {:error, _} = error -> error
      _ -> {:error, :article_purge_preconditions_not_met}
    end
  end
end
