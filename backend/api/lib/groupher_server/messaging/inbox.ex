defmodule GroupherServer.Messaging.Inbox do
  @moduledoc """
  Facade for mailbox message operations across message types.

  Account code calls this module with a message type, then the facade delegates
  to the concrete mention or notification store.

      Accounts.Mailbox
          |
          v
      Messaging.Inbox
          |
          +--> Mentions
          +--> Notifications
  """

  alias GroupherServer.Messaging.{Mentions, Notifications}

  @doc "Returns paged messages from the `Inbox` read boundary."
  def paged_messages(:mention, user, filter), do: Mentions.paged(user, filter)
  def paged_messages(:notification, user, filter), do: Notifications.paged(user, filter)

  @doc "Runs `unread_count` through the public `Inbox` boundary."
  def unread_count(:mention, user_id), do: Mentions.unread_count(user_id)
  def unread_count(:notification, user_id), do: Notifications.unread_count(user_id)

  @doc """
  Delegates a grouped unread-count query to the selected inbox store.

  Returns `{:ok, %{user_id => count}}`.
  """
  def unread_counts(:mention, user_ids), do: Mentions.unread_counts(user_ids)
  def unread_counts(:notification, user_ids), do: Notifications.unread_counts(user_ids)

  @doc "Runs `mark_read` through the public `Inbox` boundary."
  def mark_read(:mention, ids, user), do: Mentions.mark_read(ids, user)
  def mark_read(:notification, ids, user), do: Notifications.mark_read(ids, user)

  @doc "Runs `mark_read_all` through the public `Inbox` boundary."
  def mark_read_all(:mention, user), do: Mentions.mark_read_all(user)
  def mark_read_all(:notification, user), do: Notifications.mark_read_all(user)
end
