defmodule GroupherServer.Accounts.Events.Notify do
  @moduledoc """
  notify events, for upvote, collect, comment, reply
  """
  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.Messaging

  def handle(:follow, %User{} = user, %User{} = from_user) do
    notify_attrs = %{action: :follow, user_id: user.id}

    Messaging.send_notification(notify_attrs, from_user)
  end

  def handle(:undo, :follow, %User{} = user, %User{} = from_user) do
    notify_attrs = %{action: :follow, user_id: user.id}

    Messaging.revoke_notification(notify_attrs, from_user)
  end
end
