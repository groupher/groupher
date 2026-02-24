defmodule GroupherServer.CMS.Events.Notify do
  @moduledoc """
  notify events, for upvote, collect, comment, reply
  """
  alias GroupherServer.{Accounts, CMS, Delivery, Repo}
  alias CMS.Events.Event
  alias CMS.FrontDesk

  alias Accounts.Model.User
  alias CMS.Model.Comment

  @behaviour GroupherServer.CMS.Events.Handler

  @type notify_result :: {:ok, map()} | {:error, map()}
  @type handle_result :: {:ok, term()} | {:error, term()}
  @type notify_action :: :comment | :reply | :upvote | :collect

  @spec handle(Event.t()) :: handle_result()
  @impl true
  def handle(%Event{type: :notify_comment, payload: %{comment: comment, from_user: from_user}}) do
    handle(:comment, comment, from_user)
  end

  def handle(%Event{type: :notify_reply, payload: %{reply_comment: reply_comment, from_user: from_user}}) do
    handle(:reply, reply_comment, from_user)
  end

  def handle(%Event{type: :notify_upvote, payload: %{target: target, from_user: from_user}}) do
    handle(:upvote, target, from_user)
  end

  def handle(%Event{type: :notify_collect, payload: %{article: article, from_user: from_user}}) do
    handle(:collect, article, from_user)
  end

  def handle(%Event{type: :notify_undo_upvote, payload: %{target: target, from_user: from_user}}) do
    handle(:undo, :upvote, target, from_user)
  end

  def handle(%Event{type: :notify_undo_collect, payload: %{article: article, from_user: from_user}}) do
    handle(:undo, :collect, article, from_user)
  end

  @spec handle(:comment, Comment.t(), User.t()) :: notify_result()
  def handle(:comment, %Comment{} = comment, %User{} = from_user) do
    {:ok, article} = FrontDesk.article_of(comment)
    {:ok, article} = FrontDesk.preload_author(article)
    {:ok, thread} = FrontDesk.thread_of(article)

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

    {:ok, article} = FrontDesk.article_of(reply_comment)
    {:ok, article} = FrontDesk.preload_author(article)
    {:ok, thread} = FrontDesk.thread_of(article)

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
    {:ok, article} = FrontDesk.article_of(comment)
    {:ok, thread} = FrontDesk.thread_of(article)

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
    {:ok, article} = FrontDesk.preload_author(article)
    {:ok, thread} = FrontDesk.thread_of(article)

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
  def handle(:undo, action, %Comment{} = comment, %User{} = from_user) do
    {:ok, article} = FrontDesk.article_of(comment)
    {:ok, thread} = FrontDesk.thread_of(article)

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
    {:ok, article} = FrontDesk.preload_author(article)
    {:ok, thread} = FrontDesk.thread_of(article)

    notify_attrs = %{
      action: action,
      thread: thread,
      article_id: article.id,
      user_id: article.author.user.id
    }

    Delivery.revoke(:notify, notify_attrs, from_user)
  end
end
