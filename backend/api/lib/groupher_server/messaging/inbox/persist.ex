defmodule GroupherServer.Messaging.Inbox.Persist do
  @moduledoc """
  Owns row-level inbox read-state persistence for mentions and notifications.

  Commands validate the mutation boundary and choose the message type; this
  module only builds the scoped update query and delegates the row update to
  the shared ORM helper.

      Inbox command
          -> scoped read-state query
          -> Persist
          -> message rows marked read
  """

  import Ecto.Query, warn: false

  alias GroupherServer.{Messaging, Accounts}

  alias Accounts.Model.User
  alias Messaging.Model.{Mention, Notice}
  alias Helper.ORM

  @doc """
  Marks selected mention or notification rows as read for the user.

  ## Examples

      Messaging.Inbox.Persist.mark_read(:mention, ids, user)
  """
  @spec mark_read(:mention | :notification, [term()], User.t()) :: term()
  def mark_read(:mention, ids, %User{} = user) when is_list(ids) do
    Mention
    |> where(
      [message],
      message.id in ^ids and message.to_user_id == ^user.id and message.read == false
    )
    |> ORM.mark_read_all()
  end

  def mark_read(:notification, ids, %User{} = user) when is_list(ids) do
    Notice
    |> where(
      [message],
      message.id in ^ids and message.user_id == ^user.id and message.read == false
    )
    |> ORM.mark_read_all()
  end

  @doc """
  Marks every row of one message type as read for the user.

  ## Examples

      Messaging.Inbox.Persist.mark_read_all(:notification, user)
  """
  @spec mark_read_all(:mention | :notification, User.t()) :: term()
  def mark_read_all(:mention, %User{} = user) do
    Mention
    |> where([message], message.to_user_id == ^user.id and message.read == false)
    |> ORM.mark_read_all()
  end

  def mark_read_all(:notification, %User{} = user) do
    Notice
    |> where([message], message.user_id == ^user.id and message.read == false)
    |> ORM.mark_read_all()
  end
end
