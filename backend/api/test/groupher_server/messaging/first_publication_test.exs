defmodule GroupherServer.Test.Messaging.FirstPublicationTest do
  use GroupherServer.TestMate, async: false

  import Ecto.Query

  alias GroupherServer.{Accounts, CMS, Messaging}
  alias Accounts.Model.User
  alias CMS.Model.Embeds
  alias CMS.Outbox.Event
  alias Messaging.Model.Notice
  alias Messaging.Notices.Dedup

  setup do
    {:ok, article} = db_insert(:post)
    {:ok, author} = db_insert(:user, %{nickname: "Frozen author"})
    {:ok, recipient} = db_insert(:user)
    event = event(author, [author.id, recipient.id], article.id)
    %{author: author, recipient: recipient, event: event}
  end

  test "captured recipients including the author receive the frozen content and author", f do
    Repo.update!(Ecto.Changeset.change(f.author, nickname: "Current author"))

    assert {:ok, %{outcome: :delivered, recipient_ids: recipients, notice_ids: notice_ids}} =
             CMS.Articles.Effects.Publish.deliver_first_publish_notification(f.event)

    assert recipients == Enum.sort([f.author.id, f.recipient.id])
    assert length(notice_ids) == 2
    assert Repo.aggregate(Dedup, :count) == 2
    assert Repo.all(from(n in Notice, select: n.user_id, order_by: n.user_id)) == recipients

    for notice <- Repo.all(Notice) do
      assert notice.type == :article_published
      assert notice.title == "Frozen public title"
      assert notice.article_id == f.event.resource_id
      assert notice.thread == :post
      assert notice.from_users_count == 1
      assert [author] = notice.from_users
      assert author.id == f.author.id
      assert author.nickname == "Frozen author"
      assert notice.request_id == nil
      assert {:ok, 1} = Messaging.unread_count(:notification, notice.user_id)
      mailbox = Repo.get!(User, notice.user_id).mailbox
      assert mailbox.unread_notifications_count == 1
      assert mailbox.unread_total_count == 1
      refute mailbox.is_empty
    end
  end

  test "event and recipient delivery identity survives read and notice deletion", f do
    assert {:ok, _} = CMS.Articles.Effects.Publish.deliver_first_publish_notification(f.event)
    recipient_notice = Repo.get_by!(Notice, user_id: f.recipient.id)
    author_notice = Repo.get_by!(Notice, user_id: f.author.id)

    assert {:ok, _} = Messaging.mark_read(:notification, [recipient_notice.id], f.recipient)
    Repo.delete!(author_notice)
    before = facts()

    assert {:ok, %{outcome: :already_delivered, notice_ids: []}} =
             CMS.Articles.Effects.Publish.deliver_first_publish_notification(f.event)

    assert facts() == before
    assert Repo.get!(Notice, recipient_notice.id).read
    refute Repo.get(Notice, author_notice.id)

    assert Repo.get_by!(Dedup,
             delivery_key: "article-first-publication:#{f.event.id}:#{f.author.id}"
           ).notice_id == nil
  end

  test "a different event creates distinct notices instead of joining the hourly activity group",
       f do
    assert {:ok, _} = CMS.Articles.Effects.Publish.deliver_first_publish_notification(f.event)
    next = %{f.event | id: Ecto.UUID.generate(), operation_ref: Ecto.UUID.generate()}

    assert {:ok, %{outcome: :delivered, notice_ids: ids}} =
             CMS.Articles.Effects.Publish.deliver_first_publish_notification(next)

    assert length(ids) == 2
    assert Repo.aggregate(Notice, :count) == 4
    assert Repo.aggregate(Dedup, :count) == 4
  end

  test "a missing later recipient rolls earlier claims, notices and mailbox work back", f do
    missing_id = Repo.aggregate(User, :max, :id) + 100_000

    broken = %{
      f.event
      | data: Map.put(f.event.data, "notify_user_ids", [f.author.id, missing_id])
    }

    before = facts()

    assert {:error, :first_publication_recipient_not_found} =
             CMS.Articles.Effects.Publish.deliver_first_publish_notification(broken)

    assert facts() == before
  end

  @tag capture_log: true
  test "a mailbox projection SQL failure rolls all notices and delivery claims back", f do
    constraint = "test_first_publication_mailbox_#{System.unique_integer([:positive])}"

    Repo.query!("""
    ALTER TABLE account.users ADD CONSTRAINT #{constraint}
    CHECK (id <> #{f.author.id}
      OR COALESCE((mailbox->>'unread_notifications_count')::integer, 0) = 0) NOT VALID
    """)

    before = facts()
    assert {:error, _} = CMS.Articles.Effects.Publish.deliver_first_publish_notification(f.event)
    assert facts() == before
  end

  test "malformed or unsupported source events fail without claiming a recipient", f do
    variants = [
      %{f.event | contract_version: 99},
      %{f.event | operation_ref: nil},
      %{f.event | resource_id: Ecto.UUID.generate()},
      %{f.event | data: Map.delete(f.event.data, "author")},
      %{f.event | data: Map.put(f.event.data, "thread", "unknown")},
      %{f.event | data: Map.put(f.event.data, "thread", "account")},
      %{f.event | data: Map.put(f.event.data, "notify_user_ids", ["1"])},
      %{f.event | data: put_in(f.event.data, ["author", "user_id"], f.author.id + 1)},
      f.event.data
    ]

    before = facts()

    for invalid <- variants do
      assert {:error, :invalid_first_publication_notice} =
               CMS.Articles.Effects.Publish.deliver_first_publish_notification(invalid)
    end

    assert facts() == before
  end

  test "an intentionally empty captured recipient set succeeds without adding rows", f do
    empty = %{f.event | data: Map.put(f.event.data, "notify_user_ids", [])}
    before = facts()

    assert {:ok, %{outcome: :delivered, recipient_ids: [], notice_ids: []}} =
             CMS.Articles.Effects.Publish.deliver_first_publish_notification(empty)

    assert facts() == before
  end

  test "ordinary activity retains its grouping rule after first-publication index changes", f do
    attrs = %{
      user_id: f.recipient.id,
      thread: :post,
      article_id: f.event.resource_id,
      title: "Activity",
      type: :upvote
    }

    assert {:ok, first} = Messaging.send_notice(attrs, f.author)
    assert {:ok, repeated} = Messaging.send_notice(attrs, f.author)
    assert repeated.id == first.id
    assert Repo.aggregate(Notice, :count) == 1
    assert Repo.get!(Notice, first.id).type == :upvote
  end

  test "ordinary SendNotice cannot bypass event delivery identity for a first publication", f do
    before = facts()

    assert {:error, %{reason: :invalid_notice_args}} =
             Messaging.send_notice(
               %{
                 user_id: f.recipient.id,
                 type: :article_published,
                 thread: :post,
                 article_id: f.event.resource_id,
                 title: "No source event"
               },
               f.author
             )

    assert facts() == before
  end

  test "ordinary activities require an actor while system request expiry still allows none", f do
    invalid =
      Notice.changeset(%Notice{}, %{
        user_id: f.recipient.id,
        type: :article_published,
        thread: :post,
        article_id: f.event.resource_id,
        title: "Missing actor",
        from_users: [],
        from_users_count: 1
      })

    refute invalid.valid?
    assert Keyword.has_key?(invalid.errors, :from_users)

    expiry =
      Notice.changeset(%Notice{}, %{
        user_id: f.recipient.id,
        type: :result,
        request_type: :community_admin,
        request_id: Ecto.UUID.generate(),
        request_revision: 1,
        event_type: :expired,
        title: "Historical request expiry",
        from_users: [],
        from_users_count: 0
      })

    assert expiry.valid?
    assert {:ok, _} = Repo.insert(expiry)
  end

  defp event(author, recipient_ids, article_id) do
    %Event{
      id: Ecto.UUID.generate(),
      event: "article.first_published_notification",
      resource_type: "article",
      resource_id: article_id,
      operation_ref: Ecto.UUID.generate(),
      contract_version: 1,
      data: %{
        "article_id" => article_id,
        "community_id" => 7,
        "community_slug" => "frozen-community",
        "thread" => "post",
        "title" => "Frozen public title",
        "digest" => "Frozen digest",
        "author_id" => 13,
        "author_name" => author.nickname,
        "author" =>
          author
          |> Embeds.User.from_account_user()
          |> Map.from_struct()
          |> Jason.encode!()
          |> Jason.decode!(),
        "published_by_id" => author.id,
        "notify_user_ids" => recipient_ids
      }
    }
  end

  defp facts do
    Map.new([Notice, Dedup, User], fn schema ->
      {schema, Repo.all(schema) |> Map.new(&{&1.id, &1})}
    end)
  end
end
