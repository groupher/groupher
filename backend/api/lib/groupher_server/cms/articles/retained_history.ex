defmodule GroupherServer.CMS.Articles.RetainedHistory do
  @moduledoc """
  Separates ordinary Article workspace deletion from community-owned immutable history.

      permanent Trash -> remove Public / editable content / bindings -> retain identity + Snapshot
      Community destroy -> release its ownership -> retain Article history

  Other communities' ownership survives unbinding and prevents history deletion.
  Shared asset objects are never deleted here; unexpected foreign keys roll back the caller.
  """
  import Ecto.Query
  alias GroupherServer.{CMS, Repo}

  alias CMS.Model.{
    Article,
    ArticleAssetRef,
    ArticleBinding,
    ArticleBindingTrash,
    ArticleHistoryOwner,
    DocsReleaseArticle,
    DocsPublishApprovalArticle,
    DocsPostPublishConflict,
    DocsQueueArticle,
    DocsTreeNode,
    DocsTrashedArticle,
    DocsTrashedTreeNode,
    ArticlePublic,
    ArticleWorkingCopy,
    ArticleStats,
    ArticleEmotionCount,
    CommunityLifecycle,
    CoverEditWorkingCopy,
    TrashedArticle
  }

  @doc "Removes mutable/public content after the caller transitions an ordinary Article to destroy."
  def remove_workspace(%Article{thread: thread} = article, community_id) when thread != :doc do
    with true <- Repo.in_transaction?(),
         %CMS.Model.ArticleLifecycle{state: :destroy} <-
           Repo.get_by(CMS.Model.ArticleLifecycle, article_id: article.id),
         {:ok, :pass} <- ensure_unprotected(article, community_id) do
      Repo.delete_all(
        from(t in ArticleBindingTrash,
          where: t.article_id == ^article.id and t.community_id == ^community_id
        )
      )

      remove_editable(article.id)
      Repo.delete_all(from(b in ArticleBinding, where: b.article_id == ^article.id))
      Repo.delete_all(from(t in TrashedArticle, where: t.article_id == ^article.id))
      Repo.delete_all(from(s in ArticleStats, where: s.article_id == ^article.id))
      Repo.delete_all(from(s in ArticleEmotionCount, where: s.article_id == ^article.id))
      {:ok, :retained}
    else
      {:error, _} = error -> error
      _ -> {:error, :article_destroy_required}
    end
  end

  @doc "Rejects global cleanup while another site or formal Docs history protects the Article."
  def ensure_unprotected(%Article{id: article_id}, community_id) when is_integer(community_id) do
    protected =
      Repo.exists?(
        from(b in ArticleBinding,
          where: b.article_id == ^article_id and b.community_id != ^community_id
        )
      ) or
        Repo.exists?(
          from(o in ArticleHistoryOwner,
            where: o.article_id == ^article_id and o.community_id != ^community_id
          )
        ) or
        Repo.exists?(
          from(t in ArticleBindingTrash,
            where: t.article_id == ^article_id and t.community_id != ^community_id
          )
        ) or
        Repo.exists?(from(r in DocsReleaseArticle, where: r.article_id == ^article_id)) or
        Repo.exists?(from(a in DocsPublishApprovalArticle, where: a.article_id == ^article_id)) or
        Repo.exists?(from(c in DocsPostPublishConflict, where: c.article_id == ^article_id)) or
        Repo.exists?(from(q in DocsQueueArticle, where: q.article_id == ^article_id)) or
        Repo.exists?(from(n in DocsTreeNode, where: n.doc_id == ^article_id)) or
        Repo.exists?(from(t in DocsTrashedArticle, where: t.article_id == ^article_id)) or
        Repo.exists?(from(n in DocsTrashedTreeNode, where: n.doc_id == ^article_id))

    if protected do
      {:error, CMS.Articles.ErrorCat.article_history_protected()}
    else
      {:ok, :pass}
    end
  end

  @doc "Releases one destroyed Community's ownership without deleting Article history."
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
        Repo.one!(from(a in Article, where: a.id == ^article_id, lock: "FOR UPDATE"))

        Repo.delete_all(
          from(o in ArticleHistoryOwner,
            where: o.article_id == ^article_id and o.community_id == ^id
          )
        )

        Repo.delete_all(
          from(b in ArticleBinding, where: b.article_id == ^article_id and b.community_id == ^id)
        )
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
end
