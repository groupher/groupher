defmodule GroupherServer.CMS.Delegate.Hooks.SubscribeCommunity do
  @moduledoc """
  this is for auto subscribe community if user upvote article or upvote/emoji comment
  """
  import Ecto.Query, warn: false

  alias GroupherServer.{CMS, Accounts}
  alias CMS.Delegate.{CommunityOperation}
  alias CMS.Model.{Community, Comment, Post, Blog, Changelog}
  alias Accounts.Model.User

  alias Helper.ORM

  def handle(%Community{} = community, %User{} = user) do
    CommunityOperation.subscribe_community_ifnot(community, user)
  end

  def handle(%Comment{post_id: post_id}, %User{} = user) when not is_nil(post_id) do
    with {:ok, article} <- comment_parent_article(Post, post_id) do
      CommunityOperation.subscribe_community_ifnot(article.original_community, user)
    end
  end

  def handle(%Comment{changelog_id: changelog_id}, %User{} = user)
      when not is_nil(changelog_id) do
    with {:ok, article} <- comment_parent_article(Changelog, changelog_id) do
      CommunityOperation.subscribe_community_ifnot(article.original_community, user)
    end
  end

  def handle(%Comment{blog_id: blog_id}, %User{} = user) when not is_nil(blog_id) do
    with {:ok, article} <- comment_parent_article(Blog, blog_id) do
      CommunityOperation.subscribe_community_ifnot(article.original_community, user)
    end
  end

  defp comment_parent_article(article, id) do
    ORM.find(article, id, preload: [[author: :user], :original_community])
  end
end
