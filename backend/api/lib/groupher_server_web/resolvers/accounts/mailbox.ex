defmodule GroupherServerWeb.Resolvers.Accounts.Mailbox do
  @moduledoc """
  Adapts mailbox GraphQL fields to the Accounts mailbox facade.

      GraphQL mailbox field -> this resolver -> Accounts mailbox use case
  """
  import ShortMaps
  alias GroupherServer.Accounts
  alias GroupherServer.Pagi

  @doc "Returns unread totals for the signed-in user's mailbox, not the parent profile."
  def mailbox_status(_root, _args, %{context: %{cur_user: cur_user}}) do
    Accounts.mailbox_status(cur_user)
  end

  @doc "Marks the selected message IDs as read in the viewer's mailbox of the given type."
  def mark_read(_root, ~m(type ids)a, %{context: %{cur_user: cur_user}}) do
    Accounts.mailbox_mark_read(type, ids, cur_user)
  end

  @doc "Marks all unread messages of the given type as read for the viewer."
  def mark_read_all(_root, ~m(type)a, %{context: %{cur_user: cur_user}}) do
    Accounts.mailbox_mark_read_all(type, cur_user)
  end

  @doc "Lists the viewer's mentions by read state, validating pagination before the mailbox query."
  def paged_mailbox_mentions(_root, args, %{context: %{cur_user: cur_user}}) do
    with {:ok, pagi} <- Pagi.from_input(Map.get(args, :pagi)) do
      Accounts.mailbox_paged_messages(:mention, cur_user, Map.get(args, :filter) || %{}, pagi)
    end
  end

  @doc "Lists the viewer's notifications by read state, validating pagination before the mailbox query."
  def paged_mailbox_notifications(_root, args, %{context: %{cur_user: cur_user}}) do
    with {:ok, pagi} <- Pagi.from_input(Map.get(args, :pagi)) do
      Accounts.mailbox_paged_messages(
        :notification,
        cur_user,
        Map.get(args, :filter) || %{},
        pagi
      )
    end
  end
end
