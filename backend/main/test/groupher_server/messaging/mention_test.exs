defmodule GroupherServer.Test.Messaging.Mention do
  @moduledoc false

  use GroupherServer.TestMate

  import Ecto.Query, warn: false

  alias GroupherServer.Messaging

  setup do
    {:ok, post} = db_insert(:post)
    {:ok, user} = db_insert(:user)
    {:ok, user2} = db_insert(:user)
    {:ok, user3} = db_insert(:user)
    {:ok, community} = db_insert(:community)

    mention_attr = %{
      thread: "POST",
      title: post.title,
      article_id: post.id,
      comment_id: nil,
      block_linker: ["tmp"],
      inserted_at: post.updated_at |> DateTime.truncate(:second),
      updated_at: post.updated_at |> DateTime.truncate(:second)
    }

    {:ok, ~m(community post user user2 user3 mention_attr)a}
  end

  describe "mentions" do
    test "can get unread mention count of a user", ~m(post user user2 user3 mention_attr)a do
      mention_contents = [
        Map.merge(mention_attr, %{from_user_id: user.id, to_user_id: user3.id})
      ]

      {:ok, :pass} = Messaging.send_mention(post, mention_contents, user)

      mention_contents = [
        Map.merge(mention_attr, %{from_user_id: user2.id, to_user_id: user3.id})
      ]

      {:ok, :pass} = Messaging.send_mention(post, mention_contents, user2)
      {:ok, count} = Messaging.unread_count(:mention, user3.id)

      assert count == 2
    end

    test "can batch send mentions", ~m(post user user2 mention_attr)a do
      mention_contents = [
        Map.merge(mention_attr, %{from_user_id: user.id, to_user_id: user2.id})
      ]

      {:ok, :pass} = Messaging.send_mention(post, mention_contents, user)
      {:ok, result} = Messaging.paged_messages(:mention, user2, %{page: 1, size: 10})

      mention = result.entries |> List.first()

      assert mention.title == post.title
      assert mention.article_id == post.id
      assert mention.user.login == user.login
    end

    test "mention multiable times on same article, will only have one record",
         ~m(post user user2 mention_attr)a do
      mention_contents = [
        Map.merge(mention_attr, %{from_user_id: user.id, to_user_id: user2.id})
      ]

      {:ok, :pass} = Messaging.send_mention(post, mention_contents, user)
      {:ok, result} = Messaging.paged_messages(:mention, user2, %{page: 1, size: 10})

      assert result.total_count == 1

      {:ok, :pass} = Messaging.send_mention(post, mention_contents, user)
      {:ok, result} = Messaging.paged_messages(:mention, user2, %{page: 1, size: 10})

      assert result.total_count == 1
    end

    test "if mention before, update with no mention content will not do mention in final",
         ~m(post user user2 user3 mention_attr)a do
      mention_contents = [
        Map.merge(mention_attr, %{from_user_id: user.id, to_user_id: user2.id})
      ]

      {:ok, :pass} = Messaging.send_mention(post, mention_contents, user)
      {:ok, result} = Messaging.paged_messages(:mention, user2, %{page: 1, size: 10})

      assert result.total_count == 1

      {:ok, result} = Messaging.paged_messages(:mention, user3, %{page: 1, size: 10})
      assert result.total_count == 0

      mention_contents = [
        Map.merge(mention_attr, %{from_user_id: user.id, to_user_id: user3.id})
      ]

      {:ok, :pass} = Messaging.send_mention(post, mention_contents, user)
      {:ok, result} = Messaging.paged_messages(:mention, user2, %{page: 1, size: 10})
      assert result.total_count == 0

      {:ok, result} = Messaging.paged_messages(:mention, user3, %{page: 1, size: 10})
      assert result.total_count == 1
    end
  end

  describe "mark read" do
    test "can mark read a mention", ~m(post user user2 mention_attr)a do
      mention_contents = [
        Map.merge(mention_attr, %{from_user_id: user.id, to_user_id: user2.id})
      ]

      {:ok, :pass} = Messaging.send_mention(post, mention_contents, user)
      {:ok, result} = Messaging.paged_messages(:mention, user2, %{page: 1, size: 10})

      mention = result.entries |> List.first()
      {:ok, _} = Messaging.mark_read(:mention, [mention.id], user2)

      {:ok, result} = Messaging.paged_messages(:mention, user2, %{page: 1, size: 10, read: true})
      mention = result.entries |> List.first()

      assert mention.read
    end

    test "can mark multi mention as read", ~m(post user user2 user3 mention_attr)a do
      mention_contents = [
        Map.merge(mention_attr, %{from_user_id: user2.id, to_user_id: user.id})
      ]

      {:ok, :pass} = Messaging.send_mention(post, mention_contents, user2)

      mention_contents = [
        Map.merge(mention_attr, %{from_user_id: user3.id, to_user_id: user.id})
      ]

      {:ok, :pass} = Messaging.send_mention(post, mention_contents, user3)
      {:ok, result} = Messaging.paged_messages(:mention, user, %{page: 1, size: 10})

      mention1 = result.entries |> List.first()
      mention2 = result.entries |> List.last()

      {:ok, _} = Messaging.mark_read(:mention, [mention1.id, mention2.id], user)

      {:ok, result} = Messaging.paged_messages(:mention, user, %{page: 1, size: 10, read: true})

      mention1 = result.entries |> List.first()
      mention2 = result.entries |> List.last()

      assert mention1.read
      assert mention2.read
    end

    test "can mark read all", ~m(post user user2 user3 mention_attr)a do
      mention_contents = [
        Map.merge(mention_attr, %{from_user_id: user2.id, to_user_id: user.id})
      ]

      {:ok, :pass} = Messaging.send_mention(post, mention_contents, user2)

      mention_contents = [
        Map.merge(mention_attr, %{from_user_id: user3.id, to_user_id: user.id})
      ]

      {:ok, :pass} = Messaging.send_mention(post, mention_contents, user3)

      {:ok, result} = Messaging.paged_messages(:mention, user, %{page: 1, size: 10})
      assert result.total_count == 2

      {:ok, _} = Messaging.mark_read_all(:mention, user)

      {:ok, result} = Messaging.paged_messages(:mention, user, %{page: 1, size: 10})
      assert result.total_count == 0

      {:ok, result} = Messaging.paged_messages(:mention, user, %{page: 1, size: 10, read: true})
      assert result.total_count == 2
    end
  end
end
