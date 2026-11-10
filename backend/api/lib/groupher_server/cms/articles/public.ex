defmodule GroupherServer.CMS.Articles.Public do
  @moduledoc """
  Owns the current public Snapshot selection and rebuildable public projection.

      ArticleSnapshot + stable Article facts -> ArticlePublic -> public readers

  Only Publish and stable operational-state refreshes may call this module.
  """

  alias GroupherServer.{CMS, Repo}

  alias CMS.Model.{
    Article,
    ArticleSnapshot,
    ArticlePublic
  }

  @doc "Selects a same-Article immutable Snapshot and rebuilds its list projection atomically."
  def select_snapshot(%Article{id: article_id}, %ArticleSnapshot{} = snapshot, actor, opts \\ []) do
    if snapshot.article_id != article_id do
      {:error, :snapshot_owner_mismatch}
    else
      previous = Repo.get(ArticlePublic, article_id)
      published_at = Keyword.get(opts, :published_at, DateTime.utc_now(:second))

      attrs = %{
        article_id: article_id,
        snapshot_id: snapshot.id,
        published_at: published_at,
        published_by_id: actor.id,
        title: snapshot.title,
        digest: snapshot.digest,
        slug: snapshot.slug,
        plain_text: snapshot.body_plain_text,
        thumbnail: snapshot.body_thumbnail
      }

      (previous || %ArticlePublic{})
      |> ArticlePublic.changeset(attrs)
      |> Repo.insert_or_update()
    end
  end

  @doc "Loads the current public selection for a stable Article."
  @spec get(Article.t()) :: {:ok, ArticlePublic.t()} | {:error, :not_found}
  def get(%Article{id: article_id}) do
    case Repo.get(ArticlePublic, article_id) do
      %ArticlePublic{} = public -> {:ok, public}
      nil -> {:error, :not_found}
    end
  end
end
