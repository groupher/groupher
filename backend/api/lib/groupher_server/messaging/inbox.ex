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
          +--> Mentions.Query / Persist
          +--> Notices.Query / Persist
          +--> Commands.MarkRead / MarkReadAll
              -> Inbox.Persist
  """

  alias GroupherServer.Messaging
  alias Messaging.{Mentions, Notices}
  alias Messaging.Commands

  @doc """
  Returns a page from the selected inbox store.

  ## Examples

      Messaging.Inbox.paged_messages(:mention, user, %{}, %GroupherServer.Pagi.Params.Offset{page: 1, size: 20})
  """
  def paged_messages(:mention, user, filter, pagi), do: Mentions.Query.paged(user, filter, pagi)

  def paged_messages(:notification, user, filter, pagi) do
    Notices.Query.paged(user, filter, pagi)
  end

  @doc """
  Returns the unread count for one inbox store.

  ## Examples

      Messaging.Inbox.unread_count(:notification, user.id)
  """
  def unread_count(:mention, user_id), do: Mentions.Query.unread_count(user_id)
  def unread_count(:notification, user_id), do: Notices.Query.unread_count(user_id)

  @doc """
  Delegates a grouped unread-count query to the selected inbox store.

  Returns `{:ok, %{user_id => count}}`.

  ## Examples

      Messaging.Inbox.unread_counts(:mention, [user.id])
  """
  def unread_counts(:mention, user_ids), do: Mentions.Query.unread_counts(user_ids)
  def unread_counts(:notification, user_ids), do: Notices.Query.unread_counts(user_ids)

  @doc """
  Marks selected rows as read in the selected inbox store.

  ## Examples

      Messaging.Inbox.mark_read(:mention, message_ids, user)
  """
  def mark_read(type, ids, user), do: Commands.MarkRead.run(type, ids, user)

  @doc """
  Marks all rows as read in the selected inbox store.

  ## Examples

      Messaging.Inbox.mark_read_all(:notification, user)
  """
  def mark_read_all(type, user), do: Commands.MarkReadAll.run(type, user)
end
