defmodule GroupherServer.CMS.Articles.RetainedHistory do
  @moduledoc """
  Separates ordinary Article workspace deletion from community-owned immutable history.

      permanent Trash -> remove Public / editable content / bindings -> retain identity + Snapshot
      Community destroy -> release its ownership -> last owner -> purge complete Article history

  Other communities' ownership survives unbinding and prevents history deletion.
  Shared asset objects are never deleted here; unexpected foreign keys roll back the caller.
  """
  import Ecto.Query
  alias GroupherServer.{CMS, Repo}

  alias CMS.Model.{
    Article,
    ArticleAssetRef,
    ArticleBinding,
    ArticleHistoryOwner,
    ArticlePublic,
    ArticleSnapshot,
    ArticleWorkingCopy,
    ArticleStats,
    ArticleEmotionCount,
    CommunityLifecycle,
    CoverEditWorkingCopy,
    CoverEditSnapshot,
    TrashedArticle
  }

  @doc "Removes mutable/public content after the caller transitions an ordinary Article to destroy."
  def remove_workspace(%Article{thread: thread} = article) when thread != :doc do
    with true <- Repo.in_transaction?(),
         %CMS.Model.ArticleLifecycle{state: :destroy} <-
           Repo.get_by(CMS.Model.ArticleLifecycle, article_id: article.id) do
      remove_editable(article.id)
      Repo.delete_all(from(b in ArticleBinding, where: b.article_id == ^article.id))
      Repo.delete_all(from(t in TrashedArticle, where: t.article_id == ^article.id))
      Repo.delete_all(from(s in ArticleStats, where: s.article_id == ^article.id))
      Repo.delete_all(from(s in ArticleEmotionCount, where: s.article_id == ^article.id))
      {:ok, :retained}
    else
      _ -> {:error, :article_destroy_required}
    end
  end

  @doc "Releases one destroyed Community's history and purges only Articles without another owner."
  def purge_community(%CommunityLifecycle{state: :destroy, community_id: id}) do
    if Repo.in_transaction?() do
      ids =
        Repo.all(
          from(o in ArticleHistoryOwner,
            where: o.community_id == ^id,
            order_by: o.article_id,
            select: o.article_id
          )
        )

      Enum.each(ids, fn article_id ->
        article = Repo.one!(from(a in Article, where: a.id == ^article_id, lock: "FOR UPDATE"))

        Repo.delete_all(
          from(o in ArticleHistoryOwner,
            where: o.article_id == ^article_id and o.community_id == ^id
          )
        )

        Repo.delete_all(
          from(b in ArticleBinding, where: b.article_id == ^article_id and b.community_id == ^id)
        )

        unless Repo.exists?(from(o in ArticleHistoryOwner, where: o.article_id == ^article_id)) do
          purge_article(article)
        end
      end)

      {:ok, :purged}
    else
      {:error, :transaction_required}
    end
  end

  def purge_community(_), do: {:error, :community_destroy_required}

  defp remove_editable(article_id) do
    works =
      Repo.all(
        from(w in ArticleWorkingCopy,
          where: w.article_id == ^article_id,
          order_by: w.id,
          lock: "FOR UPDATE"
        )
      )

    ids = Enum.map(works, & &1.id)
    Repo.delete_all(from(p in ArticlePublic, where: p.article_id == ^article_id))
    Repo.delete_all(from(r in ArticleAssetRef, where: r.working_copy_id in ^ids))
    Repo.delete_all(from(w in ArticleWorkingCopy, where: w.id in ^ids))

    Enum.each(works, fn work ->
      if work.cover_edit_working_copy_id do
        Repo.delete_all(
          from(c in CoverEditWorkingCopy, where: c.id == ^work.cover_edit_working_copy_id)
        )
      end
    end)
  end

  defp purge_article(article) do
    remove_editable(article.id)

    snapshots =
      Repo.all(
        from(s in ArticleSnapshot,
          where: s.article_id == ^article.id,
          order_by: s.id,
          lock: "FOR UPDATE"
        )
      )

    ids = Enum.map(snapshots, & &1.id)
    Repo.delete_all(from(r in ArticleAssetRef, where: r.snapshot_id in ^ids))
    Repo.delete_all(from(s in ArticleSnapshot, where: s.id in ^ids))

    Enum.each(snapshots, fn snapshot ->
      if snapshot.cover_edit_snapshot_id do
        Repo.delete_all(
          from(c in CoverEditSnapshot, where: c.id == ^snapshot.cover_edit_snapshot_id)
        )
      end
    end)

    Repo.query!("DELETE FROM account.collect_folder_entries WHERE article_id=$1", [
      Ecto.UUID.dump!(article.id)
    ])

    Repo.delete!(article)
  end
end
