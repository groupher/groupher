defmodule GroupherServer.Test.Messaging.NoticeContract do
  use GroupherServer.TestMate, async: false
  import Ecto.Query

  alias GroupherServer.Messaging.Model.Notice

  test "Messaging accepts the activity types from the generated Notice contract" do
    assert GroupherServer.Messaging.Config.notify_actions() == [
             :upvote,
             :comment,
             :reply,
             :collect,
             :follow,
             :ticket_status,
             :ticket_update,
             :ticket_visibility
           ]
  end

  test "request Notice dimensions come from one generated contract" do
    assert GroupherServer.Messaging.NoticeContract.request_types() == [
             :article_co_author,
             :community_admin
           ]

    assert GroupherServer.Messaging.NoticeContract.request_actions() == [:invite, :apply, :result]

    assert GroupherServer.Messaging.NoticeContract.request_events() == [
             :created,
             :decided,
             :cancelled,
             :expired
           ]
  end

  test "database rejects request Notice action and event mismatches" do
    {:ok, recipient} = db_insert(:user)
    {:ok, actor} = db_insert(:user)
    now = DateTime.utc_now(:second)

    assert_raise Postgrex.Error, fn ->
      Repo.insert_all(Notice, [
        %{
          user_id: recipient.id,
          type: :result,
          title: "request",
          read: false,
          from_users: [GroupherServer.CMS.Model.Embeds.User.from_account_user(actor)],
          from_users_count: 1,
          request_type: :community_admin,
          request_id: Ecto.UUID.generate(),
          request_revision: 1,
          event_type: :created,
          inserted_at: now,
          updated_at: now
        }
      ])
    end
  end

  test "request Notices bypass the hourly activity aggregation index" do
    {:ok, recipient} = db_insert(:user)
    {:ok, actor} = db_insert(:user)
    now = DateTime.utc_now(:second)

    rows =
      for _ <- 1..2 do
        %{
          user_id: recipient.id,
          type: :invite,
          title: "request",
          read: false,
          from_users: [GroupherServer.CMS.Model.Embeds.User.from_account_user(actor)],
          from_users_count: 1,
          request_type: :community_admin,
          request_id: Ecto.UUID.generate(),
          request_revision: 1,
          event_type: :created,
          inserted_at: now,
          updated_at: now
        }
      end

    assert {2, nil} = Repo.insert_all(Notice, rows)

    assert Repo.aggregate(
             from(notice in Notice,
               where: notice.user_id == ^recipient.id and not is_nil(notice.request_id)
             ),
             :count
           ) == 2
  end
end
