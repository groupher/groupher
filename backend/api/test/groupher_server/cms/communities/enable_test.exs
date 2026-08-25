defmodule GroupherServer.Test.CMS.Communities.Enable do
  @moduledoc false

  use GroupherServer.TestMate

  alias GroupherServer.CMS.Communities.Enable

  setup do
    {:ok, user} = db_insert(:user)
    community_attrs = mock_attrs(:community)
    {:ok, community} = CMS.Communities.create(community_attrs, user)

    {:ok, community: community}
  end

  describe "[emotion policy]" do
    test "falls back to default thread emotions when community has no override", ~m(community)a do
      assert {:ok, :post_comment} = Enable.emotion?(community.slug, :comment, :post, :beer)
      assert {:ok, :post} = Enable.emotion?(community.slug, :article, :post, :upvote)

      assert {:error, %ErrorCat.Error{reason: :emotion_not_allowed}} =
               Enable.emotion?(community.slug, :comment, :post, :upvote)
    end

    test "reads community dashboard override for comment thread emotions", ~m(community)a do
      {:ok, _} =
        CMS.Dashboard.update(community, :thread_emotions, %{
          post_comment: [:heart]
        })

      assert {:error, %ErrorCat.Error{reason: :emotion_not_allowed}} =
               Enable.emotion?(community.slug, :comment, :post, :beer)

      assert {:ok, :post_comment} =
               Enable.emotion?(community.slug, :comment, :post, :heart)
    end

    test "reads community dashboard override for article thread emotions", ~m(community)a do
      {:ok, _} =
        CMS.Dashboard.update(community, :thread_emotions, %{
          post: [:heart]
        })

      assert {:error, %ErrorCat.Error{reason: :emotion_not_allowed}} =
               Enable.emotion?(community.slug, :article, :post, :beer)

      assert {:ok, :post} = Enable.emotion?(community.slug, :article, :post, :heart)
    end

    test "returns false for unsupported emotion keys", ~m(community)a do
      assert {:error, %ErrorCat.Error{reason: :emotion_not_allowed}} =
               Enable.emotion?(community.slug, :comment, :post, :not_exist)

      assert {:error, %ErrorCat.Error{reason: :emotion_not_allowed}} =
               Enable.emotion?(community.slug, :article, :post, :not_exist)
    end

    test "allow_emotion returns done format for allowed emotions", ~m(community)a do
      assert {:ok, :post_comment} = Enable.emotion?(community.slug, :comment, :post, :beer)

      assert {:ok, :post} = Enable.emotion?(community.slug, :article, :post, :upvote)
    end

    test "allow_emotion returns cancan error key for disallowed emotions", ~m(community)a do
      assert {:error, %ErrorCat.Error{reason: :emotion_not_allowed}} =
               Enable.emotion?(community.slug, :comment, :post, :upvote)

      {:ok, _} =
        CMS.Dashboard.update(community, :thread_emotions, %{
          post_comment: [:heart]
        })

      assert {:error, %ErrorCat.Error{reason: :emotion_not_allowed}} =
               Enable.emotion?(community.slug, :comment, :post, :beer)
    end
  end

  describe "[thread visibility policy]" do
    test "allow_thread returns thread in done format when enabled", ~m(community)a do
      assert {:ok, :post} = Enable.thread?(community.slug, :post)
    end

    test "allow_thread rejects non-atom threads", ~m(community)a do
      assert {:error, %GroupherServer.ErrorCat.Error{reason: :custom, details: "invalid thread"}} =
               Enable.thread?(community.slug, "POST")
    end

    test "allow_thread returns cancan error key when disabled", ~m(community)a do
      {:ok, _} =
        CMS.Dashboard.update(community, :enable, %{
          post: false
        })

      assert {:error, %ErrorCat.Error{reason: :thread_not_visible}} =
               Enable.thread?(community.slug, :post)
    end
  end
end
