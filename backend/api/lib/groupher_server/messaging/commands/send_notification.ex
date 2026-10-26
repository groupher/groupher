defmodule GroupherServer.Messaging.Commands.SendNotification do
  @moduledoc """
  Owns the atomic create-or-merge notification command.

      SendNotification
          -> Notifications.Persist
          -> Accounts.mailbox_update_status_many_in_transaction/1
          -> commit -> Accounts.mailbox_invalidate_users/1
  """

  use GroupherServer.CommandPipeline

  alias GroupherServer.{Accounts, Messaging}
  alias Accounts.Model.User
  alias Messaging.ErrorCat
  alias Messaging.Notifications.{Delivery, Persist}

  @pipeline operation: :messaging_send_notification,
            access: :open,
            target: :from_user,
            params: [:attrs]

  direct_pipeline execute_pipeline(attrs, from_user) do
    prepare(fn ->
      with %{user_id: user_id} <- attrs,
           true <- Persist.valid?(attrs),
           true <- user_id !== from_user.id do
        {:ok, attrs}
      else
        _ -> {:error, ErrorCat.invalid_notification_args()}
      end
    end)

    change(fn attrs ->
      case deliver(attrs, from_user) do
        {:error, reason} -> {:error, reason}
        result -> {:ok, result}
      end
    end)

    present(fn %{result: notification, users: users} ->
      _ = Accounts.mailbox_invalidate_users(users)
      {:ok, notification}
    end)
  end

  @doc """
  Creates or merges a notification for a recipient.

  ## Examples

      Messaging.Commands.SendNotification.run(attrs, user)
  """
  @spec run(map(), User.t()) :: {:ok, struct() | :already_delivered} | {:error, term()}
  def run(%{action: _action} = attrs, %User{} = from_user) do
    execute_pipeline(attrs, from_user)
  end

  def run(_attrs, _from_user), do: {:error, ErrorCat.invalid_notification_args()}

  defp deliver(%{delivery_key: delivery_key} = attrs, from_user)
       when is_binary(delivery_key) and delivery_key != "" do
    case Delivery.claim(delivery_key) do
      {:ok, :claimed} ->
        attrs
        |> Map.delete(:delivery_key)
        |> persist_notification(from_user, delivery_key)

      {:ok, :already_delivered} ->
        %{result: :already_delivered, users: []}
    end
  end

  defp deliver(attrs, from_user) do
    attrs
    |> Map.delete(:delivery_key)
    |> persist_notification(from_user, nil)
  end

  defp persist_notification(attrs, from_user, delivery_key) do
    with {:ok, notification} <- Persist.upsert(attrs, from_user),
         {:ok, :pass} <- maybe_attach_delivery(delivery_key, notification),
         {:ok, users} <-
           Accounts.mailbox_update_status_many_in_transaction([notification.user_id]) do
      %{result: notification, users: users}
    else
      {:error, reason} -> {:error, reason}
    end
  end

  defp maybe_attach_delivery(nil, _notification), do: {:ok, :pass}

  defp maybe_attach_delivery(delivery_key, notification) do
    Delivery.attach(delivery_key, notification)
  end
end
