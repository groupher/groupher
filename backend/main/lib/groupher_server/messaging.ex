defmodule GroupherServer.Messaging do
  @moduledoc """
  Messaging context facade.
  """

  alias GroupherServer.Messaging.{Inbox, Mentions, Notifications, Notify}

  def send_mention(artiment, mentions, from_user), do: Mentions.send(artiment, mentions, from_user)

  def send_notification(attrs, from_user), do: Notifications.send(attrs, from_user)

  def revoke_notification(attrs, from_user), do: Notifications.revoke(attrs, from_user)

  def paged_mentions(user, filter), do: Mentions.paged(user, filter)
  def paged_notifications(user, filter), do: Notifications.paged(user, filter)

  def unread_count(type, user_id), do: Inbox.unread_count(type, user_id)
  def mark_read(type, ids, user), do: Inbox.mark_read(type, ids, user)
  def mark_read_all(type, user), do: Inbox.mark_read_all(type, user)
  def paged_messages(type, user, filter), do: Inbox.paged_messages(type, user, filter)

  def notify(event, payload), do: Notify.dispatch(event, payload)
end
