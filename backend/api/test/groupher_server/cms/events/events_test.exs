defmodule GroupherServer.Test.CMS.Events.EventsTest do
  @moduledoc false

  use GroupherServer.TestMate

  alias GroupherServer.{CMS, Messaging}
  alias CMS.Events

  setup do
    {community, post, _post_attrs, user} = mock_article(:post)
    {:ok, user2} = db_insert(:user)

    {:ok, ~m(community post user user2)a}
  end

  describe "emit/3" do
    test "routes notify_upvote event", ~m(post user2)a do
      {:ok, post} = CMS.Articles.Reader.load_article_for_notification(post.id)
      {:ok, article} = CMS.Interactions.upvote(post, user2)

      {:ok, _} = Events.emit(:notify_upvote, %{target: article, from_user: user2})

      {:ok, notifications} =
        Messaging.paged_messages(:notification, post.author, %{page: 1, size: 20})

      assert notifications.total_count == 1
    end

    test "returns error for unknown event type" do
      assert {:error,
              %ErrorCat.Error{
                reason: :invalid_event_type,
                details: :unknown_type
              }} = Events.emit(:unknown_type, %{})
    end
  end
end
