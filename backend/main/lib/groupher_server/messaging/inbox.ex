defmodule GroupherServer.Messaging.Inbox do
  @moduledoc false

  alias GroupherServer.Messaging.{Mentions, Notifications}

  def paged_messages(:mention, user, filter), do: Mentions.paged(user, filter)
  def paged_messages(:notification, user, filter), do: Notifications.paged(user, filter)

  def unread_count(:mention, user_id), do: Mentions.unread_count(user_id)
  def unread_count(:notification, user_id), do: Notifications.unread_count(user_id)

  def mark_read(:mention, ids, user), do: Mentions.mark_read(ids, user)
  def mark_read(:notification, ids, user), do: Notifications.mark_read(ids, user)

  def mark_read_all(:mention, user), do: Mentions.mark_read_all(user)
  def mark_read_all(:notification, user), do: Notifications.mark_read_all(user)
end
