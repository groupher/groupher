defmodule GroupherServer.Accounts.Mailboxes do
  @moduledoc false

  alias Helper.Types, as: T

  alias GroupherServer.Accounts.Delegate.Mailbox
  alias GroupherServer.Accounts.Model.User

  @spec mailbox_status(User.t()) :: T.domain_res(map())
  def mailbox_status(user), do: Mailbox.mailbox_status(user)

  @spec update_mailbox_status(T.id()) :: T.domain_res(User.t())
  def update_mailbox_status(user_id), do: Mailbox.update_mailbox_status(user_id)

  @spec mark_read(atom(), [T.id()], User.t()) :: T.domain_res(map())
  def mark_read(type, ids, user), do: Mailbox.mark_read(type, ids, user)

  @spec mark_read_all(atom(), User.t()) :: T.domain_res(map())
  def mark_read_all(type, user), do: Mailbox.mark_read_all(type, user)

  @spec paged_mailbox_messages(atom(), User.t(), map()) :: T.domain_res(T.paged_data())
  def paged_mailbox_messages(type, user, filter),
    do: Mailbox.paged_mailbox_messages(type, user, filter)
end
