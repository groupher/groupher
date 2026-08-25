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

  alias GroupherServer.Messaging.{Inbox, Mentions, Notifications, Notify}

  @doc "Stores mention messages derived from an artiment and its parsed mentions."
  def send_mention(artiment, mentions, from_user),
    do: Mentions.send(artiment, mentions, from_user)

  @doc "Stores a grouped activity notification for its recipient."
  def send_notification(attrs, from_user), do: Notifications.send(attrs, from_user)

  @doc "Revokes a previously stored activity notification matching the supplied facts."
  def revoke_notification(attrs, from_user), do: Notifications.revoke(attrs, from_user)

  @doc "Returns the current user's paged direct-mention inbox."
  def paged_mentions(user, filter), do: Mentions.paged(user, filter)

  @doc "Returns the current user's paged activity-notification inbox."
  def paged_notifications(user, filter), do: Notifications.paged(user, filter)

  @doc "Returns the unread count for one inbox message type and user."
  def unread_count(type, user_id), do: Inbox.unread_count(type, user_id)

  @doc """
  Returns unread counts grouped by user ID for one inbox message type.

  Users without unread rows are omitted; callers that need a complete user set
  should supply their own zero defaults.
  """
  def unread_counts(type, user_ids), do: Inbox.unread_counts(type, user_ids)

  @doc "Marks selected inbox rows as read for the current user."
  def mark_read(type, ids, user), do: Inbox.mark_read(type, ids, user)

  @doc "Marks every inbox row of a message type as read for the current user."
  def mark_read_all(type, user), do: Inbox.mark_read_all(type, user)

  @doc "Returns a paged inbox using the requested message-type adapter."
  def paged_messages(type, user, filter), do: Inbox.paged_messages(type, user, filter)

  @doc "Dispatches a messaging event through the bounded notification side-effect adapter."
  def notify(event, payload), do: Notify.dispatch(event, payload)
end
