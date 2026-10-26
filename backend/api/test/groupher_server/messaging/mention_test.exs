defmodule GroupherServer.Test.Messaging.Mention do
  @moduledoc false

  use GroupherServer.TestMate

  import Ecto.Query, warn: false

  alias GroupherServer.Messaging
  alias Messaging.Model.Mention
  alias CMS.Model.{ArticleLifecycle, ArticleReviewBlock}

  setup do
    {community, post, _attrs, _author} = mock_article(:post)
    {:ok, user} = db_insert(:user)
    {:ok, user2} = db_insert(:user)
    {:ok, user3} = db_insert(:user)

    mention_attr = %{
      thread: :post,
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
    test "does not deliver inbox mentions while Gate hides review-restricted content",
         ~m(post user user2 mention_attr)a do
      _lifecycle = Repo.get_by!(ArticleLifecycle, article_id: post.id)

      Repo.insert!(%ArticleReviewBlock{
        article_id: post.id,
        type: :awaiting_human,
        source_ref: "mention-test",
        source: :request,
        applied_at: DateTime.utc_now(:second)
      })

      mentions = [Map.merge(mention_attr, %{from_user_id: user.id, to_user_id: user2.id})]

      assert {:error, :content_not_public} = Messaging.send_mention(post, mentions, user)

      assert Repo.aggregate(from(m in Mention, where: m.article_id == ^post.id), :count) == 0
    end

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

      assert count == 1
    end

    test "can batch send mentions", ~m(post user user2 mention_attr)a do
      mention_contents = [
        Map.merge(mention_attr, %{from_user_id: user.id, to_user_id: user2.id})
      ]

      {:ok, :pass} = Messaging.send_mention(post, mention_contents, user)

      {:ok, result} =
        Messaging.paged_messages(:mention, user2, %{}, %GroupherServer.Pagi.Params.Offset{
          page: 1,
          size: 10
        })

      mention = result.entries |> List.first()

      assert mention.title == post.title
      assert mention.article_id == post.id
      assert mention.user.login == user.login
    end

    test "replaying a mention preserves its read state and does not duplicate it",
         ~m(post user user2 mention_attr)a do
      mention_contents = [
        Map.merge(mention_attr, %{from_user_id: user.id, to_user_id: user2.id})
      ]

      {:ok, :pass} = Messaging.send_mention(post, mention_contents, user)

      {:ok, unread} =
        Messaging.paged_messages(:mention, user2, %{}, %GroupherServer.Pagi.Params.Offset{
          page: 1,
          size: 10
        })

      [mention] = unread.entries
      {:ok, _} = Messaging.mark_read(:mention, [mention.id], user2)

      {:ok, :pass} = Messaging.send_mention(post, mention_contents, user)

      {:ok, result} =
        Messaging.paged_messages(
          :mention,
          user2,
          %{read: true},
          %GroupherServer.Pagi.Params.Offset{
            page: 1,
            size: 10
          }
        )

      assert result.total_count == 1
      assert hd(result.entries).read
    end

    test "a new content revision delivers a new recipient without retracting history",
         ~m(post user user2 user3 mention_attr)a do
      mention_contents = [
        Map.merge(mention_attr, %{from_user_id: user.id, to_user_id: user2.id})
      ]

      {:ok, :pass} = Messaging.send_mention(post, mention_contents, user)

      {:ok, result} =
        Messaging.paged_messages(:mention, user2, %{}, %GroupherServer.Pagi.Params.Offset{
          page: 1,
          size: 10
        })

      assert result.total_count == 1

      {:ok, result} =
        Messaging.paged_messages(:mention, user3, %{}, %GroupherServer.Pagi.Params.Offset{
          page: 1,
          size: 10
        })

      assert result.total_count == 0

      next_revision = Map.put(post, :revision_id, Ecto.UUID.generate())

      mention_contents = [
        Map.merge(mention_attr, %{from_user_id: user.id, to_user_id: user3.id})
      ]

      {:ok, :pass} = Messaging.send_mention(next_revision, mention_contents, user)

      {:ok, result} =
        Messaging.paged_messages(:mention, user2, %{}, %GroupherServer.Pagi.Params.Offset{
          page: 1,
          size: 10
        })

      assert result.total_count == 1

      {:ok, result} =
        Messaging.paged_messages(:mention, user3, %{}, %GroupherServer.Pagi.Params.Offset{
          page: 1,
          size: 10
        })

      assert result.total_count == 1
    end
  end

  describe "mark read" do
    test "can mark read a mention", ~m(post user user2 mention_attr)a do
      mention_contents = [
        Map.merge(mention_attr, %{from_user_id: user.id, to_user_id: user2.id})
      ]

      {:ok, :pass} = Messaging.send_mention(post, mention_contents, user)

      {:ok, result} =
        Messaging.paged_messages(:mention, user2, %{}, %GroupherServer.Pagi.Params.Offset{
          page: 1,
          size: 10
        })

      mention = result.entries |> List.first()
      {:ok, _} = Messaging.mark_read(:mention, [mention.id], user2)

      {:ok, result} =
        Messaging.paged_messages(
          :mention,
          user2,
          %{read: true},
          %GroupherServer.Pagi.Params.Offset{
            page: 1,
            size: 10
          }
        )

      mention = result.entries |> List.first()

      assert mention.read
    end

    test "can mark multi mention as read", ~m(community post user user2 user3 mention_attr)a do
      mention_contents = [
        Map.merge(mention_attr, %{from_user_id: user2.id, to_user_id: user.id})
      ]

      {:ok, :pass} = Messaging.send_mention(post, mention_contents, user2)

      {_community, post2, _attrs, _author} = mock_article(:post, community, user3)
      mention_attr2 = Map.merge(mention_attr, %{article_id: post2.id, title: post2.title})

      mention_contents = [
        Map.merge(mention_attr2, %{from_user_id: user3.id, to_user_id: user.id})
      ]

      {:ok, :pass} = Messaging.send_mention(post2, mention_contents, user3)

      {:ok, result} =
        Messaging.paged_messages(:mention, user, %{}, %GroupherServer.Pagi.Params.Offset{
          page: 1,
          size: 10
        })

      mention1 = result.entries |> List.first()
      mention2 = result.entries |> List.last()

      {:ok, _} = Messaging.mark_read(:mention, [mention1.id, mention2.id], user)

      {:ok, result} =
        Messaging.paged_messages(
          :mention,
          user,
          %{read: true},
          %GroupherServer.Pagi.Params.Offset{
            page: 1,
            size: 10
          }
        )

      mention1 = result.entries |> List.first()
      mention2 = result.entries |> List.last()

      assert mention1.read
      assert mention2.read
    end

    test "can mark read all", ~m(community post user user2 user3 mention_attr)a do
      mention_contents = [
        Map.merge(mention_attr, %{from_user_id: user2.id, to_user_id: user.id})
      ]

      {:ok, :pass} = Messaging.send_mention(post, mention_contents, user2)

      {_community, post2, _attrs, _author} = mock_article(:post, community, user3)
      mention_attr2 = Map.merge(mention_attr, %{article_id: post2.id, title: post2.title})

      mention_contents = [
        Map.merge(mention_attr2, %{from_user_id: user3.id, to_user_id: user.id})
      ]

      {:ok, :pass} = Messaging.send_mention(post2, mention_contents, user3)

      {:ok, result} =
        Messaging.paged_messages(:mention, user, %{}, %GroupherServer.Pagi.Params.Offset{
          page: 1,
          size: 10
        })

      assert result.total_count == 2

      {:ok, _} = Messaging.mark_read_all(:mention, user)

      {:ok, result} =
        Messaging.paged_messages(:mention, user, %{}, %GroupherServer.Pagi.Params.Offset{
          page: 1,
          size: 10
        })

      assert result.total_count == 0

      {:ok, result} =
        Messaging.paged_messages(
          :mention,
          user,
          %{read: true},
          %GroupherServer.Pagi.Params.Offset{
            page: 1,
            size: 10
          }
        )

      assert result.total_count == 2
    end
  end
end
