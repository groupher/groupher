defmodule GroupherServer.CMS.Events.Notify do
  @moduledoc """
  Converts CMS interaction events into persisted Messaging notifications.

  The handler resolves the affected article, author, thread, and recipient,
  then delegates create/revoke operations to Messaging. Events whose content
  has already been deleted are treated as an idempotent pass.

  Business position:

      Domain write
        -> CMS.Events
        -> Notify
        -> bounded side effect
  """

  require GroupherServer.CMS.ErrorCat

  alias GroupherServer.{Accounts, CMS, Messaging, Repo}
  alias Accounts.Model.User
  alias CMS.{ErrorCat, Events.Event, FrontDesk}
  alias CMS.Model.{Comment, Community}

  @behaviour CMS.Events.Handler

  @type notify_result :: {:ok, map()} | {:error, map()}
  @type handle_result :: {:ok, term()} | {:error, term()}
  @type notify_action :: :comment | :reply | :upvote | :collect

  @doc """
  Handles notify events by converting them into persisted Messaging notifications.

  Supported types are `:notify_comment`, `:notify_reply`, `:notify_upvote`,
  `:notify_collect`, and their `:notify_undo_*` counterparts. Content that was
  already deleted resolves to `{:ok, :pass}`.
  """
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
         {:ok, thread} <- FrontDesk.thread_of(article),
         {:ok, author} <- article_author(article) do
      notify_attrs = %{
        action: :comment,
        thread: thread,
        article_id: stable_article_id(article),
        branch_id: Map.get(article, :branch_id),
        title: article.title,
        comment_id: comment.id,
        user_id: author.id
      }

      Messaging.send_notification(notify_attrs, from_user)
    else
      error -> handle_missing_target(error)
    end
  end

  @spec handle(:reply, Comment.t(), User.t()) :: notify_result()
  def handle(:reply, %Comment{} = reply_comment, %User{} = from_user) do
    with %Comment{reply_to_comment: %{author_id: reply_to_author_id}} = reply_comment <-
           Repo.preload(reply_comment, reply_to_comment: :author),
         {:ok, article} <- FrontDesk.article_of(reply_comment),
         {:ok, thread} <- FrontDesk.thread_of(article) do
      notify_attrs = %{
        action: :reply,
        thread: thread,
        article_id: stable_article_id(article),
        branch_id: Map.get(article, :branch_id),
        title: article.title,
        comment_id: reply_comment.id,
        user_id: reply_to_author_id
      }

      Messaging.send_notification(notify_attrs, from_user)
    else
      %Comment{reply_to_comment: nil} -> {:ok, :pass}
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
        branch_id: Map.get(article, :branch_id),
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
    with {:ok, article} <- load_article_for_notification(article),
         {:ok, thread} <- FrontDesk.thread_of(article),
         {:ok, author} <- article_author(article) do
      notify_attrs = %{
        action: action,
        thread: thread,
        article_id: article.id,
        branch_id: Map.get(article, :branch_id),
        title: article.title,
        user_id: author.id
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
        branch_id: Map.get(article, :branch_id),
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
    with {:ok, article} <- load_article_for_notification(article),
         {:ok, thread} <- FrontDesk.thread_of(article),
         {:ok, author} <- article_author(article) do
      notify_attrs = %{
        action: action,
        thread: thread,
        article_id: article.id,
        user_id: author.id
      }

      Messaging.revoke_notification(notify_attrs, from_user)
    else
      error -> handle_missing_target(error)
    end
  end

  defp article_author(%{author: %User{} = user}), do: {:ok, user}
  defp article_author(%{author: %{user: %User{} = user}}), do: {:ok, user}
  defp article_author(_article), do: {:error, ErrorCat.custom("article author not found")}

  defp load_article_for_notification(%{id: article_id, community: %Community{} = community}) do
    CMS.Articles.Store.load_article_for_notification(article_id, community)
  end

  defp load_article_for_notification(%{article_id: article_id} = article)
       when not is_nil(article_id) do
    {:ok, article}
  end

  defp load_article_for_notification(_article) do
    {:error, ErrorCat.custom("article not found")}
  end

  defp stable_article_id(%{id: article_id}) when is_binary(article_id), do: article_id

  defp stable_article_id(%{article_id: article_id}) when is_binary(article_id), do: article_id

  # Background jobs may arrive after related content is deleted; skip quietly.
  defp handle_missing_target(
         {:error, ErrorCat.error_pattern(reason: :custom, details: %{reason: :not_exist})}
       ) do
    {:ok, :pass}
  end

  defp handle_missing_target({:error, ErrorCat.error_pattern(reason: :not_exist)}) do
    {:ok, :pass}
  end

  defp handle_missing_target({:error, _} = error), do: error
end
