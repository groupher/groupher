defmodule GroupherServer.Test.Accounts.Events.Notify do
  @moduledoc false

  use GroupherServer.TestMate

  alias GroupherServer.{Accounts, Messaging}
  alias Accounts.{Events, Fans}

  setup do
    {:ok, user} = db_insert(:user)
    {:ok, user2} = db_insert(:user)

    {:ok, ~m(user user2 )a}
  end

  describe "[follow notify]" do
    test "typed follow Worker delivers to the target and attributes the follower",
         ~m(user user2)a do
      assert {:ok, _notification} =
               GroupherServer.Jobs.AccountEvent.perform(%Oban.Job{
                 args: %{
                   "type" => "follow",
                   "version" => 1,
                   "user_id" => user.id,
                   "from_user_id" => user2.id
                 }
               })

      assert {:ok, %{total_count: 1, entries: [notification]}} =
               Messaging.paged_messages(
                 :notification,
                 user,
                 %{},
                 %GroupherServer.Pagi.Params.Offset{
                   page: 1,
                   size: 20
                 }
               )

      assert notification.user_id == user.id
      assert user_exist_in?(user2, notification.from_users)

      assert {:ok, %{total_count: 0}} =
               Messaging.paged_messages(
                 :notification,
                 user2,
                 %{},
                 %GroupherServer.Pagi.Params.Offset{
                   page: 1,
                   size: 20
                 }
               )
    end

    test "follow notify hook should work", ~m(user user2)a do
      {:ok, _} = Fans.follow(user, user2)
      Events.emit(:follow, %{user: user, from_user: user2})

      {:ok, notifications} =
        Messaging.paged_messages(:notification, user, %{}, %GroupherServer.Pagi.Params.Offset{
          page: 1,
          size: 20
        })

      assert notifications.total_count == 1

      notify = notifications.entries |> List.first()
      assert notify.type == :follow
      assert notify.user_id == user.id
      assert user_exist_in?(user2, notify.from_users)
    end

    test "undo follow notify hook should work", ~m(user user2)a do
      {:ok, _} = Fans.follow(user, user2)
      Events.emit(:follow, %{user: user, from_user: user2})
      Events.emit(:undo_follow, %{user: user, from_user: user2})

      {:ok, notifications} =
        Messaging.paged_messages(:notification, user, %{}, %GroupherServer.Pagi.Params.Offset{
          page: 1,
          size: 20
        })

      assert notifications.total_count == 0
    end
  end
end
