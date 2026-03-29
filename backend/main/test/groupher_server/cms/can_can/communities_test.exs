defmodule GroupherServer.Test.CMS.CanCan.Communities do
  @moduledoc false

  use GroupherServer.TestMate

  alias CMS.CanCan

  setup do
    {:ok, user} = db_insert(:user)
    community_attrs = mock_attrs(:community)
    {:ok, community} = CMS.Communities.create(community_attrs, user)

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

    test "ensure_emotion_allowed returns done format for allowed emotions", ~m(community)a do
      assert {:ok, :post_comment} =
               CanCan.ensure_emotion_allowed(community.slug, :comment, :post, :beer)

      assert {:ok, :post} =
               CanCan.ensure_emotion_allowed(community.slug, :article, :post, :upvote)
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

  describe "[thread visibility policy]" do
    test "ensure_thread_visible returns thread in done format when enabled", ~m(community)a do
      assert {:ok, :post} = CanCan.ensure_thread_visible(community.slug, :post)
    end

    test "ensure_thread_visible returns cancan error key when disabled", ~m(community)a do
      {:ok, _} =
        CMS.Communities.update_dashboard(community, :enable, %{
          post: false
        })

      assert {:error, :thread_not_visible} =
               CanCan.ensure_thread_visible(community.slug, :post)
    end
  end
end
