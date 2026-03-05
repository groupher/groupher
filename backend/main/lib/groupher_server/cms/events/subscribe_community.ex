defmodule GroupherServer.CMS.Events.SubscribeCommunity do
  @moduledoc """
  this is for auto subscribe community if user upvote article or upvote/emoji comment
  """
  import Ecto.Query, warn: false

  alias GroupherServer.CMS

  alias CMS.Communities
  alias CMS.Events.Event
  alias CMS.Model.{Blog, Changelog, Comment, Community, Doc, Post}

  @behaviour CMS.Events.Handler

  @type subscribe_result :: {:ok, struct()} | {:error, map()}
  @type handle_result :: {:ok, term()} | {:error, term()}

  @spec handle(Event.t()) :: handle_result()
  @impl true
  def handle(%Event{type: :subscribe_community, payload: %{target: target, user: user}}) do
    handle(target, user)
  end

  @spec handle(Community.t(), map()) :: subscribe_result()
  def handle(%Community{} = community, user) do
    Communities.subscribe_ifnot(community, user)
  end

  @spec handle(Comment.t(), map()) :: subscribe_result()
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

  def handle(%Comment{doc_id: doc_id}, user) when not is_nil(doc_id) do
    with {:ok, article} <- comment_parent_article(Doc, doc_id) do
      Communities.subscribe_ifnot(article.community, user)
    end
  end

  @spec comment_parent_article(module(), integer() | String.t()) ::
          {:ok, struct()} | {:error, map()}
  defp comment_parent_article(article, id) do
    GroupherServer.CMS.FrontDesk.get(article, id, preload: [[author: :user], :community])
  end
end
