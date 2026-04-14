defmodule GroupherServer.Test.CMS.PolymorphicArticleWritesTest do
  @moduledoc false

  use GroupherServer.TestMate

  alias GroupherServer.CMS.Model.{AbuseReport, ArticleCollect, ArticleUpvote}

  setup do
    {community, post, _, user} = mock_article(:post, preload: [author: :user])

    {:ok, other_user} = db_insert(:user)

    {:ok, ~m(community post user other_user)a}
  end

  describe "business writes keep polymorphic refs consistent" do
    test "create_comment persists only the matching article ref", ~m(community post user)a do
      {:ok, comment} =
        CMS.Comments.create_comment(community, :post, post.inner_id, mock_comment(), user)

      {:ok, comment} = ORM.find(Comment, comment.id)

      assert comment.thread == :post
      assert comment.post_id == post.id
      assert is_nil(comment.blog_id)
      assert is_nil(comment.changelog_id)
      assert is_nil(comment.doc_id)
    end

    test "upvote persists only the matching article ref", ~m(post user)a do
      {:ok, _post} = CMS.Articles.upvote(post, user)

      assert {:ok, upvote} =
               ORM.find_by(ArticleUpvote, %{user_id: user.id, thread: :post, post_id: post.id})

      assert upvote.post_id == post.id
      assert is_nil(upvote.blog_id)
      assert is_nil(upvote.changelog_id)
      assert is_nil(upvote.doc_id)
    end

    test "collect persists only the matching article ref", ~m(post user)a do
      {:ok, _collect} = CMS.Articles.collect(post, user)

      assert {:ok, collect} =
               ORM.find_by(ArticleCollect, %{user_id: user.id, thread: :post, post_id: post.id})

      assert collect.post_id == post.id
      assert is_nil(collect.blog_id)
      assert is_nil(collect.changelog_id)
      assert is_nil(collect.doc_id)
    end

    test "article report persists at most one article ref", ~m(post other_user)a do
      {:ok, _post} = CMS.AbuseReports.article(post, "spam", "title", other_user)

      assert {:ok, report} = ORM.find_by(AbuseReport, %{post_id: post.id})

      assert report.post_id == post.id
      assert is_nil(report.blog_id)
      assert is_nil(report.changelog_id)
      assert is_nil(report.doc_id)
    end
  end
end
