defmodule GroupherServer.Accounts.Events.Notify do
  @moduledoc """
  Translates account follow/unfollow events into Messaging notifications.

  The module owns the account-event payload shape only. Persisting and revoking
  inbox notifications remains the responsibility of `GroupherServer.Messaging`.

  Business position:

      Client / Auth
        -> GraphQL or internal API
        -> Accounts facade
        -> Notify
        -> Repo
  """
  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.Messaging

  @doc "Creates a follow notification for the target user."
  def handle(:follow, %User{} = user, %User{} = from_user) do
    notify_attrs = %{action: :follow, user_id: user.id}

    Messaging.send_notification(notify_attrs, from_user)
  end

  @doc "Revokes the matching follow notification after an unfollow."
  def handle(:undo, :follow, %User{} = user, %User{} = from_user) do
    notify_attrs = %{action: :follow, user_id: user.id}

    Messaging.revoke_notification(notify_attrs, from_user)
  end
end
