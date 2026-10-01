defmodule GroupherServer.CMS.Articles.Public do
  @moduledoc """
  Owns the current public Revision selection and rebuildable public projection.

      ArticleRevision + stable Article facts -> ArticlePublic -> public readers

  Only Publish and stable operational-state refreshes may call this module.
  """

  alias GroupherServer.{CMS, Repo}
  alias CMS.Model.{Article, ArticleBodySnapshot, ArticlePublic, ArticleRevision, Author}

  @doc "Selects a Revision as current public content and atomically refreshes its projection."
  @spec select(Article.t(), ArticleRevision.t(), Author.t(), keyword()) ::
          {:ok, ArticlePublic.t()} | {:error, Ecto.Changeset.t() | :revision_owner_mismatch}
  def select(article, revision, actor, opts \\ [])

  def select(
        %Article{id: article_id} = article,
        %ArticleRevision{article_id: article_id} = revision,
        %Author{} = actor,
        opts
      ) do
    previous = Repo.get(ArticlePublic, article.id)
    published_at = Keyword.get(opts, :published_at, DateTime.utc_now(:second))
    body = Repo.get!(ArticleBodySnapshot, revision.body_snapshot_id)

    attrs = %{
      article_id: article.id,
      revision_id: revision.id,
      published_at: published_at,
      published_by_id: actor.id,
      publication_version: (previous && previous.publication_version + 1) || 1,
      title: revision.title,
      digest: revision.digest,
      slug: revision.slug,
      body_hash: body.body_hash,
      excerpt: body.plain_text,
      thumbnail: body.thumbnail,
      active_at: article.active_at || published_at,
      visible: article.moderation_state == :legal
    }

    (previous || %ArticlePublic{})
    |> ArticlePublic.changeset(attrs)
    |> Repo.insert_or_update()
  end

  def select(%Article{}, %ArticleRevision{}, %Author{}, _opts),
    do: {:error, :revision_owner_mismatch}

  @doc "Loads the current public selection for a stable Article."
  @spec get(Article.t()) :: {:ok, ArticlePublic.t()} | {:error, :not_found}
  def get(%Article{id: article_id}) do
    case Repo.get(ArticlePublic, article_id) do
      %ArticlePublic{} = public -> {:ok, public}
      nil -> {:error, :not_found}
    end
  end
end
