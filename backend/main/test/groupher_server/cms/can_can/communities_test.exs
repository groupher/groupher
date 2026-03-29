defmodule GroupherServer.Test.CMS.CanCan.Communities do
  @moduledoc false

  use GroupherServer.TestMate

  alias CMS.CanCan

  setup do
    {:ok, community} = db_insert(:community)

    {:ok, community: community}
  end

  describe "[emotion policy]" do
    test "falls back to default thread emotions when community has no override", ~m(community)a do
      assert CanCan.emotion_allowed?(community.slug, :comment, :post, :beer)
      assert CanCan.emotion_allowed?(community.slug, :article, :post, :upvote)
      refute CanCan.emotion_allowed?(community.slug, :comment, :post, :upvote)
    end

    test "reads community dashboard override for comment thread emotions", ~m(community)a do
      {:ok, _} =
        CMS.Communities.update_dashboard(community, :thread_emotions, %{
          post_comment: [:heart]
        })

      refute CanCan.emotion_allowed?(community.slug, :comment, :post, :beer)
      assert CanCan.emotion_allowed?(community.slug, :comment, :post, :heart)
    end

    test "reads community dashboard override for article thread emotions", ~m(community)a do
      {:ok, _} =
        CMS.Communities.update_dashboard(community, :thread_emotions, %{
          post: [:heart]
        })

      refute CanCan.emotion_allowed?(community.slug, :article, :post, :beer)
      assert CanCan.emotion_allowed?(community.slug, :article, :post, :heart)
    end

    test "returns false for unsupported emotion keys", ~m(community)a do
      refute CanCan.emotion_allowed?(community.slug, :comment, :post, :not_exist)
      refute CanCan.emotion_allowed?(community.slug, :article, :post, :not_exist)
    end

    test "ensure_emotion_allowed returns :ok for allowed emotions", ~m(community)a do
      assert :ok = CanCan.ensure_emotion_allowed(community.slug, :comment, :post, :beer)
      assert :ok = CanCan.ensure_emotion_allowed(community.slug, :article, :post, :upvote)
    end

    test "ensure_emotion_allowed returns cancan error key for disallowed emotions", ~m(community)a do
      assert {:error, :emotion_not_allowed} =
               CanCan.ensure_emotion_allowed(community.slug, :comment, :post, :upvote)

      {:ok, _} =
        CMS.Communities.update_dashboard(community, :thread_emotions, %{
          post_comment: [:heart]
        })

      assert {:error, :emotion_not_allowed} =
               CanCan.ensure_emotion_allowed(community.slug, :comment, :post, :beer)
    end
  end
end
