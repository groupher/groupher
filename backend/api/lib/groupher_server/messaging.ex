defmodule GroupherServer.Messaging do
  @moduledoc """
  Public messaging boundary for mentions, notifications, and inbox state.

  It routes domain events to the appropriate message store and exposes the
  viewer-facing read/mark-read operations without leaking storage modules.

  Business position:

      Application caller
        -> Messaging
        -> domain / infrastructure boundary
  """

  alias GroupherServer.Messaging
  alias Messaging.{Commands, Inbox, Mentions, Notifications, Notify}

  @doc """
  Stores mention messages derived from an artiment and its parsed mentions.

  ## Examples

      Messaging.send_mention(comment, mentions, user)
  """
  def send_mention(artiment, mentions, from_user) do
    Commands.SendMention.run(artiment, mentions, from_user)
  end

  @doc "Records mention mailbox rows within the caller's transaction; invalidate after commit."
  def record_mention_in_transaction(artiment, mentions, from_user) do
    Commands.SendMention.record_in_transaction(artiment, mentions, from_user)
  end

  @doc """
  Stores a grouped activity notification for its recipient.

  ## Examples

      Messaging.send_notification(notification_attrs, user)
  """
  def send_notification(attrs, from_user), do: Commands.SendNotification.run(attrs, from_user)

  @doc """
  Revokes a previously stored activity notification matching the supplied facts.

  ## Examples

      Messaging.revoke_notification(notification_attrs, user)
  """
  def revoke_notification(attrs, from_user), do: Commands.RevokeNotification.run(attrs, from_user)

  @doc """
  Returns the current user's paged direct-mention inbox.

  ## Examples

      Messaging.paged_mentions(user, %{}, %GroupherServer.Pagi.Params.Offset{page: 1, size: 20})
  """
  def paged_mentions(user, filter, pagi), do: Mentions.Query.paged(user, filter, pagi)

  @doc """
  Returns the current user's paged activity-notification inbox.

  ## Examples

      Messaging.paged_notifications(user, %{}, %GroupherServer.Pagi.Params.Offset{page: 1, size: 20})
  """
  def paged_notifications(user, filter, pagi), do: Notifications.Query.paged(user, filter, pagi)

  @doc """
  Returns the unread count for one inbox message type and user.

  ## Examples

      Messaging.unread_count(:mention, user.id)
  """
  def unread_count(type, user_id), do: Inbox.unread_count(type, user_id)

  @doc """
  Returns unread counts grouped by user ID for one inbox message type.

  Users without unread rows are omitted; callers that need a complete user set
  should supply their own zero defaults.

  ## Examples

      Messaging.unread_counts(:notification, [user.id, another_user.id])
  """
  def unread_counts(type, user_ids), do: Inbox.unread_counts(type, user_ids)

  @doc """
  Marks selected inbox rows as read for the current user.

  ## Examples

      Messaging.mark_read(:mention, message_ids, user)
  """
  def mark_read(type, ids, user), do: Inbox.mark_read(type, ids, user)

  @doc """
  Marks every inbox row of a message type as read for the current user.

  ## Examples

      Messaging.mark_read_all(:notification, user)
  """
  def mark_read_all(type, user), do: Inbox.mark_read_all(type, user)

  @doc """
  Returns a paged inbox using the requested message-type adapter.

  ## Examples

      Messaging.paged_messages(:mention, user, %{}, %GroupherServer.Pagi.Params.Offset{page: 1, size: 20})
  """
  def paged_messages(type, user, filter, pagi), do: Inbox.paged_messages(type, user, filter, pagi)

  @doc """
  Dispatches a messaging event through the bounded notification side-effect adapter.

  ## Examples

      Messaging.notify(:comment_created, %{comment_id: comment.id})
  """
  def notify(event, payload), do: Notify.dispatch(event, payload)
end
