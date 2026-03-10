defmodule GroupherServer.CMS.Events.Notify do
  @moduledoc """
  notify events, for upvote, collect, comment, reply
  """
  alias GroupherServer.{Accounts, CMS, Messaging, Repo}

  alias Accounts.Model.User
  alias CMS.Events.Event
  alias CMS.FrontDesk
  alias CMS.Model.Comment

  @behaviour CMS.Events.Handler

  @type notify_result :: {:ok, map()} | {:error, map()}
  @type handle_result :: {:ok, term()} | {:error, term()}
  @type notify_action :: :comment | :reply | :upvote | :collect

  @spec handle(Event.t()) :: handle_result()
  @impl true
  def handle(%Event{type: :notify_comment, payload: %{comment: comment, from_user: from_user}}) do
    handle(:comment, comment, from_user)
  end

  def handle(%Event{
        type: :notify_reply,
        payload: %{reply_comment: reply_comment, from_user: from_user}
      }) do
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

  def handle(%Event{
        type: :notify_undo_collect,
        payload: %{article: article, from_user: from_user}
      }) do
    handle(:undo, :collect, article, from_user)
  end

  @spec handle(:comment, Comment.t(), User.t()) :: notify_result()
  def handle(:comment, %Comment{} = comment, %User{} = from_user) do
    with {:ok, article} <- FrontDesk.article_of(comment),
         {:ok, article} <- FrontDesk.preload_author(article),
         {:ok, thread} <- FrontDesk.thread_of(article) do
      notify_attrs = %{
        action: :comment,
        thread: thread,
        article_id: article.id,
        title: article.title,
        comment_id: comment.id,
        user_id: article.author.user.id
      }

      Messaging.send_notification(notify_attrs, from_user)
    else
      error -> handle_missing_target(error)
    end
  end

  @spec handle(:reply, Comment.t(), User.t()) :: notify_result()
  def handle(:reply, %Comment{} = reply_comment, %User{} = from_user) do
    with %Comment{reply_to: %{author_id: reply_to_author_id}} = reply_comment <-
           Repo.preload(reply_comment, reply_to: :author),
         {:ok, article} <- FrontDesk.article_of(reply_comment),
         {:ok, article} <- FrontDesk.preload_author(article),
         {:ok, thread} <- FrontDesk.thread_of(article) do
      notify_attrs = %{
        action: :reply,
        thread: thread,
        article_id: article.id,
        title: article.title,
        comment_id: reply_comment.id,
        user_id: reply_to_author_id
      }

      Messaging.send_notification(notify_attrs, from_user)
    else
      %Comment{reply_to: nil} -> {:ok, :pass}
      error -> handle_missing_target(error)
    end
  end

  @spec handle(notify_action(), Comment.t(), User.t()) :: notify_result()
  def handle(action, %Comment{} = comment, %User{} = from_user) do
    with {:ok, article} <- FrontDesk.article_of(comment),
         {:ok, thread} <- FrontDesk.thread_of(article) do
      notify_attrs = %{
        action: action,
        thread: thread,
        article_id: article.id,
        title: article.title,
        user_id: comment.author_id,
        comment_id: comment.id
      }

      Messaging.send_notification(notify_attrs, from_user)
    else
      error -> handle_missing_target(error)
    end
  end

  @spec handle(notify_action(), map(), User.t()) :: notify_result()
  def handle(action, article, %User{} = from_user) do
    with {:ok, article} <- FrontDesk.preload_author(article),
         {:ok, thread} <- FrontDesk.thread_of(article) do
      notify_attrs = %{
        action: action,
        thread: thread,
        article_id: article.id,
        title: article.title,
        user_id: article.author.user.id
      }

      Messaging.send_notification(notify_attrs, from_user)
    else
      error -> handle_missing_target(error)
    end
  end

  @spec handle(:undo, notify_action(), Comment.t(), User.t()) :: notify_result()
  def handle(:undo, action, %Comment{} = comment, %User{} = from_user) do
    with {:ok, article} <- FrontDesk.article_of(comment),
         {:ok, thread} <- FrontDesk.thread_of(article) do
      notify_attrs = %{
        action: action,
        thread: thread,
        article_id: article.id,
        title: article.title,
        comment_id: comment.id,
        user_id: comment.author_id
      }

      Messaging.revoke_notification(notify_attrs, from_user)
    else
      error -> handle_missing_target(error)
    end
  end

  @spec handle(:undo, notify_action(), map(), User.t()) :: notify_result()
  def handle(:undo, action, article, %User{} = from_user) do
    with {:ok, article} <- FrontDesk.preload_author(article),
         {:ok, thread} <- FrontDesk.thread_of(article) do
      notify_attrs = %{
        action: action,
        thread: thread,
        article_id: article.id,
        user_id: article.author.user.id
      }

      Messaging.revoke_notification(notify_attrs, from_user)
    else
      error -> handle_missing_target(error)
    end
  end

  # Background jobs may arrive after related content is deleted; skip quietly.
  defp handle_missing_target({:error, :not_exist}), do: {:ok, :pass}
  defp handle_missing_target({:error, {:not_exist, _}}), do: {:ok, :pass}
  defp handle_missing_target({:error, _} = error), do: error
end
