defmodule GroupherServer.CMS.Articles.Reader do
  @moduledoc """
  Named persistence reads for the Article aggregate and its owned rows.

  This module is intentionally narrower than a generic ORM lookup facade:
  callers name the Article fact they need and the owning Reader keeps the
  preload shape local to that fact.

  Business position:

      CMS command / event / projection
        -> Articles.Reader named fact
        -> stable Article rows or public Article projection
  """

  alias GroupherServer.CMS.Model.{
    Article,
    ArticleBodyDraft,
    ArticleCommunity,
    ArticleDraft,
    DraftCoverEdit,
    ArticleLifecycle,
    ArticlePublic,
    ArticleRevision,
    Author,
    Community
  }
  alias GroupherServer.CMS.Model.RevisionCoverEdit
  alias GroupherServer.CMS.FrontDesk.Article, as: PublicArticleReader

  alias GroupherServer.Repo
  alias Helper.ORM

  defp article(id), do: ORM.find(Article, id)

  @doc "Loads an Article author by its persisted author id."
  def author(id), do: ORM.find(Author, id)

  @doc "Loads the public Article data required to build a notification."
  def load_article_for_notification(article_id), do: load_public_article(article_id)

  @doc "Loads the public Article data required to rebuild Article mentions."
  def load_article_for_mentions(article_id), do: load_public_article(article_id)

  @doc "Loads one ArticleLifecycle row by stable Article id."
  def lifecycle(article_id), do: ORM.find_by(ArticleLifecycle, article_id: article_id)

  @doc "Loads one current mutable Article Draft row."
  def draft(article_id), do: ORM.find_by(ArticleDraft, article_id: article_id)

  @doc "Loads one mutable rich-text body owned by an Article Draft."
  def body_draft(id), do: ORM.find(ArticleBodyDraft, id)

  @doc "Loads one current ordinary Article public row."
  def public(article_id), do: ORM.find(ArticlePublic, article_id)

  @doc "Loads one Article revision row."
  def revision(revision_id), do: ORM.find(ArticleRevision, revision_id)

  @doc "Loads the home Community relation for one Article."
  def home_relation(article_id),
    do: ORM.find_by(ArticleCommunity, article_id: article_id, role: :home)

  defp community(community_id), do: ORM.find(Community, community_id)

  @doc "Ensures an Article has the Community association needed by an effect."
  def with_community(%Article{} = article), do: {:ok, Repo.preload(article, :community)}

  @doc "Loads one Draft cover edit projection."
  def draft_cover_edit(id), do: ORM.find(DraftCoverEdit, id)

  @doc "Loads one Revision cover edit projection."
  def revision_cover_edit(id), do: ORM.find(RevisionCoverEdit, id)

  defp load_public_article(article_id) do
    with {:ok, article} <- article(article_id),
         {:ok, community} <- community(article.community_id) do
      PublicArticleReader.read(
        %{community: community.slug, thread: article.thread, inner_id: article.inner_id},
        nil,
        []
      )
    end
  end
end
