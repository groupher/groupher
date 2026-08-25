defmodule GroupherServer.Test.CMS.PolymorphicArticleConstraintsTest do
  @moduledoc false

  use GroupherServer.TestMate
  import GroupherServer.DataCase, only: [errors_on: 1]

  alias GroupherServer.CMS.Model.{
    AbuseReport,
    ArticleCollect,
    ArticleUpvote,
    ArticleUserEmotion,
    Comment,
    Embeds,
    PinnedComment
  }

  setup do
    {community, post, _, user} = mock_article(:post, preload: [author: :user])
    {_, blog, _, _} = mock_article(:blog, community, user)
    {:ok, other_user} = db_insert(:user)

    {:ok, ~m(community post blog user other_user)a}
  end

  describe "polymorphic article constraints" do
    test "comment rejects multiple article refs", ~m(community post blog user)a do
      attrs = valid_comment_attrs(user.id, community.id, post)

      assert {:error, changeset} =
               %Comment{}
               |> Comment.changeset(Map.put(attrs, :blog_id, blog.id))
               |> Repo.insert()

      assert "is invalid" in errors_on(changeset).post_id
    end

    test "comment rejects thread mismatches article ref", ~m(community post user)a do
      attrs =
        valid_comment_attrs(user.id, community.id, post)
        |> Map.put(:thread, :blog)

      assert {:error, changeset} =
               %Comment{}
               |> Comment.changeset(attrs)
               |> Repo.insert()

      assert "is invalid" in errors_on(changeset).thread
    end

    test "comment rejects a community that does not own its article", ~m(post user other_user)a do
      {:ok, other_community} = mock_community(other_user)
      attrs = valid_comment_attrs(user.id, other_community.id, post)

      assert {:error, changeset} =
               %Comment{}
               |> Comment.changeset(attrs)
               |> Repo.insert()

      assert "is invalid" in errors_on(changeset).community_id
    end

    test "article upvote rejects multiple article refs", ~m(post blog user)a do
      attrs = %{user_id: user.id, thread: :post, post_id: post.id, blog_id: blog.id}

      assert {:error, changeset} =
               %ArticleUpvote{}
               |> ArticleUpvote.changeset(attrs)
               |> Repo.insert()

      assert "is invalid" in errors_on(changeset).post_id
    end

    test "article collect rejects thread mismatches article ref", ~m(post user)a do
      attrs = %{user_id: user.id, thread: :blog, post_id: post.id, collect_folders: []}

      assert {:error, changeset} =
               %ArticleCollect{}
               |> ArticleCollect.changeset(attrs)
               |> Repo.insert()

      assert "is invalid" in errors_on(changeset).thread
    end

    test "pinned comment rejects multiple article refs", ~m(community post blog user)a do
      {:ok, comment} =
        CMS.Comments.create_comment(community, :post, post.inner_id, mock_comment(), user)

      attrs = %{comment_id: comment.id, post_id: post.id, blog_id: blog.id}

      assert {:error, changeset} =
               %PinnedComment{}
               |> PinnedComment.changeset(attrs)
               |> Repo.insert()

      assert "is invalid" in errors_on(changeset).post_id
    end

    test "article user emotion rejects multiple article refs", ~m(post blog user other_user)a do
      attrs = %{
        user_id: user.id,
        received_user_id: other_user.id,
        emotion: "beer",
        post_id: post.id,
        blog_id: blog.id
      }

      assert {:error, changeset} =
               %ArticleUserEmotion{}
               |> ArticleUserEmotion.changeset(attrs)
               |> Repo.insert()

      assert "is invalid" in errors_on(changeset).post_id
    end

    test "abuse report rejects multiple article refs", ~m(post blog user)a do
      attrs = %{
        account_id: user.id,
        post_id: post.id,
        blog_id: blog.id,
        report_cases: [valid_report_case(user)]
      }

      assert {:error, changeset} =
               %AbuseReport{}
               |> AbuseReport.changeset(attrs)
               |> Repo.insert()

      assert "is invalid" in errors_on(changeset).post_id
    end
  end

  defp valid_comment_attrs(user_id, community_id, post) do
    %{
      author_id: user_id,
      community_id: community_id,
      body: "comment-body",
      body_html: "<p>comment-body</p>",
      inner_id: 1,
      thread: :post,
      post_id: post.id,
      article_hash_id: post.article_hash_id,
      emotions: Embeds.CommentEmotion.default_emotions(),
      meta: Embeds.CommentMeta.default_meta()
    }
  end

  defp valid_report_case(user) do
    %{
      reason: "spam",
      attr: "body_html",
      user: Embeds.User.from_account_user(user) |> Map.from_struct()
    }
  end
end
