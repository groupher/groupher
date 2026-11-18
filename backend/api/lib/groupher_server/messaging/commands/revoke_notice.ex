defmodule GroupherServer.Messaging.Commands.RevokeNotice do
  @moduledoc """
  Owns the atomic removal of an actor from grouped notifications.

      RevokeNotice
          -> Notices.Persist
          -> Accounts.mailbox_update_status_many_in_transaction/1
          -> commit -> Accounts.mailbox_invalidate_users/1
  """

  use GroupherServer.CommandPipeline

  alias GroupherServer.{Accounts, Messaging}
  alias Accounts.Model.User
  alias Messaging.Notices.Persist

  @pipeline operation: :messaging_revoke_notice,
            access: :open,
            target: :from_user,
            params: [:attrs]

  direct_pipeline execute_pipeline(attrs, from_user) do
    prepare(fn ->
      case Persist.find_for_revoke(attrs, from_user) do
        {:error, _reason} -> {:ok, %{notifications: []}}
        {:ok, notifications} -> {:ok, %{notifications: notifications}}
      end
    end)

    change(fn %{notifications: notifications} ->
      if notifications == [] do
        {:ok, %{users: []}}
      else
        with {:ok, :pass} <- Persist.revoke_rows(notifications, from_user),
             {:ok, users} <-
               notifications
               |> Enum.map(& &1.user_id)
               |> Accounts.mailbox_update_status_many_in_transaction() do
          {:ok, %{users: users}}
        end
      end
    end)

    present(fn %{users: users} ->
      _ = Accounts.mailbox_invalidate_users(users)
      {:ok, :pass}
    end)
  end

  @doc """
  Revokes one actor's contribution from matching grouped notifications.

  ## Examples

      Messaging.Commands.RevokeNotice.run(attrs, user)
  """
  @spec run(map(), User.t()) :: {:ok, :pass} | {:error, term()}
  def run(attrs, %User{} = from_user), do: execute_pipeline(attrs, from_user)
end
