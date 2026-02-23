defmodule GroupherServer.CMS.Events.Notify do
  @moduledoc """
  notify events, for upvote, collect, comment, reply
  """
  import GroupherServer.CMS.FrontDesk,
    only: [preload_author: 1, article_of: 1, thread_of: 1]

  alias GroupherServer.{Accounts, CMS, Delivery, Repo}

  alias Accounts.Model.User
  alias CMS.Model.Comment

  @behaviour GroupherServer.CMS.Events.TernaryHandler
  @behaviour GroupherServer.CMS.Events.QuaternaryHandler

  @type notify_result :: {:ok, map()} | {:error, map()}
  @type notify_action :: :comment | :reply | :upvote | :collect

  @spec handle(:comment, Comment.t(), User.t()) :: notify_result()
  @impl true
  def handle(:comment, %Comment{} = comment, %User{} = from_user) do
    {:ok, article} = article_of(comment)
    {:ok, article} = preload_author(article)
    {:ok, thread} = thread_of(article)

    notify_attrs = %{
      action: :comment,
      thread: thread,
      article_id: article.id,
      title: article.title,
      comment_id: comment.id,
      user_id: article.author.user.id
    }

    Delivery.send(:notify, notify_attrs, from_user)
  end

  @spec handle(:reply, Comment.t(), User.t()) :: notify_result()
  def handle(:reply, %Comment{} = reply_comment, %User{} = from_user) do
    reply_comment = Repo.preload(reply_comment, reply_to: :author)

    {:ok, article} = article_of(reply_comment)
    {:ok, article} = preload_author(article)
    {:ok, thread} = thread_of(article)

    notify_attrs = %{
      action: :reply,
      thread: thread,
      article_id: article.id,
      title: article.title,
      comment_id: reply_comment.id,
      user_id: reply_comment.reply_to.author_id
    }

    Delivery.send(:notify, notify_attrs, from_user)
  end

  @spec handle(notify_action(), Comment.t(), User.t()) :: notify_result()
  def handle(action, %Comment{} = comment, %User{} = from_user) do
    {:ok, article} = article_of(comment)
    {:ok, thread} = thread_of(article)

    notify_attrs = %{
      action: action,
      thread: thread,
      article_id: article.id,
      title: article.title,
      user_id: comment.author_id,
      comment_id: comment.id
    }

    Delivery.send(:notify, notify_attrs, from_user)
  end

  @spec handle(notify_action(), map(), User.t()) :: notify_result()
  def handle(action, article, %User{} = from_user) do
    {:ok, article} = preload_author(article)
    {:ok, thread} = thread_of(article)

    notify_attrs = %{
      action: action,
      thread: thread,
      article_id: article.id,
      title: article.title,
      user_id: article.author.user.id
    }

    Delivery.send(:notify, notify_attrs, from_user)
  end

  @spec handle(:undo, notify_action(), Comment.t(), User.t()) :: notify_result()
  @impl true
  def handle(:undo, action, %Comment{} = comment, %User{} = from_user) do
    {:ok, article} = article_of(comment)
    {:ok, thread} = thread_of(article)

    notify_attrs = %{
      action: action,
      thread: thread,
      article_id: article.id,
      title: article.title,
      comment_id: comment.id,
      user_id: comment.author_id
    }

    Delivery.revoke(:notify, notify_attrs, from_user)
  end

  @spec handle(:undo, notify_action(), map(), User.t()) :: notify_result()
  def handle(:undo, action, article, %User{} = from_user) do
    {:ok, article} = preload_author(article)
    {:ok, thread} = thread_of(article)

    notify_attrs = %{
      action: action,
      thread: thread,
      article_id: article.id,
      user_id: article.author.user.id
    }

    Delivery.revoke(:notify, notify_attrs, from_user)
  end
end
