defmodule GroupherServer.CMS.Delegate.Hooks.SubscribeCommunity do
  @moduledoc """
  this is for auto subscribe community if user upvote article or upvote/emoji comment
  """
  import Ecto.Query, warn: false

  alias GroupherServer.CMS
  alias CMS.Communities
  alias CMS.Model.{Community, Comment, Post, Blog, Changelog}
  alias Helper.ORM

  def handle(%Community{} = community, user) do
    Communities.subscribe_ifnot(community, user)
  end

  def handle(%Comment{post_id: post_id}, user) when not is_nil(post_id) do
    with {:ok, article} <- comment_parent_article(Post, post_id) do
      Communities.subscribe_ifnot(article.community, user)
    end
  end

  def handle(%Comment{changelog_id: changelog_id}, user)
      when not is_nil(changelog_id) do
    with {:ok, article} <- comment_parent_article(Changelog, changelog_id) do
      Communities.subscribe_ifnot(article.community, user)
    end
  end

  def handle(%Comment{blog_id: blog_id}, user) when not is_nil(blog_id) do
    with {:ok, article} <- comment_parent_article(Blog, blog_id) do
      Communities.subscribe_ifnot(article.community, user)
    end
  end

  defp comment_parent_article(article, id) do
    ORM.find(article, id, preload: [[author: :user], :community])
  end
end
