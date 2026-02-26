defmodule GroupherServer.Test.Accounts.Events.Notify do
  @moduledoc false

  use GroupherServer.TestTools

  alias GroupherServer.Accounts.Events
  alias GroupherServer.Accounts.Fans
  alias GroupherServer.Messaging

  setup do
    {:ok, user} = db_insert(:user)
    {:ok, user2} = db_insert(:user)

    {:ok, ~m(user user2 )a}
  end

  describe "[follow notify]" do
    test "follow notify hook should work", ~m(user user2)a do
      {:ok, _} = Fans.follow(user, user2)
      Events.emit(:follow, %{user: user, from_user: user2})

      {:ok, notifications} = Messaging.paged_messages(:notification, user, %{page: 1, size: 20})
      assert notifications.total_count == 1

      notify = notifications.entries |> List.first()
      assert notify.action == "FOLLOW"
      assert notify.user_id == user.id
      assert user_exist_in?(user2, notify.from_users)
    end

    test "undo follow notify hook should work", ~m(user user2)a do
      {:ok, _} = Fans.follow(user, user2)
      Events.emit(:follow, %{user: user, from_user: user2})
      Events.emit(:undo_follow, %{user: user, from_user: user2})

      {:ok, notifications} = Messaging.paged_messages(:notification, user, %{page: 1, size: 20})
      assert notifications.total_count == 0
    end
  end
end
