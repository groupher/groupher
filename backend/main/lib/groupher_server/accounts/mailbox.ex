defmodule GroupherServer.Accounts.Mailbox do
  @moduledoc false

  import Ecto.Query, warn: false
  import Helper.Utils, only: [done: 1]

  alias GroupherServer.FrontDesk
  alias GroupherServer.Messaging
  alias GroupherServer.Accounts.Model.{Embeds, User}
  alias Helper.ORM

  @default_status Embeds.UserMailbox.default_status()

  def status(%User{mailbox: nil}), do: done(@default_status)
  def status(%User{mailbox: mailbox}), do: done(mailbox)

  def mark_read(type, ids, %User{} = user), do: Messaging.mark_read(type, ids, user)
  def mark_read_all(type, %User{} = user), do: Messaging.mark_read_all(type, user)
  def paged_messages(type, user, filter), do: Messaging.paged_messages(type, user, filter)

  @doc "update messages count in mailbox"
  def update_status(user_id) do
    with {:ok, user} <- ORM.find(User, user_id),
         {:ok, unread_mentions_count} <- Messaging.unread_count(:mention, user_id),
         {:ok, unread_notifications_count} <- Messaging.unread_count(:notification, user_id) do
      unread_total_count = unread_mentions_count + unread_notifications_count

      mailbox = %{
        unread_mentions_count: unread_mentions_count,
        unread_notifications_count: unread_notifications_count,
        unread_total_count: unread_total_count,
        is_empty: unread_total_count < 1
      }

      user
      |> ORM.update_embed(:mailbox, mailbox)
      |> revalidate_user()
    end
  end

  def update_status_many(user_ids) when is_list(user_ids) do
    user_ids
    |> Enum.reject(&is_nil/1)
    |> Enum.uniq()
    |> Enum.each(&update_status/1)
    |> done()
  end

  defp revalidate_user({:ok, %User{login: login}} = response) when is_binary(login) do
    FrontDesk.revalidate().user(login)
    response
  end

  defp revalidate_user(response), do: response
end
