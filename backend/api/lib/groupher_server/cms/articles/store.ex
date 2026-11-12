defmodule GroupherServer.CMS.Articles.Store do
  @moduledoc """
  Named persistence reads for the Article aggregate and its owned rows.

  This module is intentionally narrower than a generic ORM lookup facade:
  callers name the Article fact they need and the owning Query keeps the
  preload shape local to that fact.

  Business position:

      CMS command / event / projection
        -> Articles.Store named fact
        -> stable Article rows or public Article projection
  """

  alias GroupherServer.CMS
  alias CMS.Articles.ErrorCat, as: ArticleErrorCat

  alias CMS.Model.{
    Article,
    ArticleBinding,
    Author,
    Community
  }

  alias CMS.Articles.{Bindings, ArticleView}
  alias CMS.FrontDesk.Article, as: PublicArticleFrontDesk

  alias Helper.ORM

  @doc "Loads an Article author by its persisted author id."
  def author(id), do: ORM.find(Author, id)

  @doc "Loads the public Article data required to build a notification."
  def load_article_for_notification(article_id, %Community{} = community) do
    load_public_article(article_id, community)
  end

  @doc "Loads the public Article data required to rebuild Article mentions."
  def load_article_for_mentions(article_id, %Community{} = community) do
    load_public_article(article_id, community)
  end

  @doc "Loads one ArticleBinding binding for a Community."
  def binding(article_id, community_id) do
    ORM.find_by(ArticleBinding, article_id: article_id, community_id: community_id)
  end

  @doc "Ensures an Article has the Community association needed by an effect."
  def with_community(%Article{}), do: {:error, ArticleErrorCat.binding_context_required()}

  def with_community(%ArticleView{community: %Community{}} = article), do: {:ok, article}

  def with_community(%ArticleView{} = _article) do
    {:error, ArticleErrorCat.binding_context_required()}
  end

  defp load_public_article(article_id, %Community{} = community) do
    with {:ok, article} <- ORM.find(Article, article_id),
         {:ok, %{inner_id: inner_id}} <- Bindings.get(article, community) do
      PublicArticleFrontDesk.read(
        %{community: community.slug, thread: article.thread, inner_id: inner_id},
        nil,
        []
      )
    end
  end
end
