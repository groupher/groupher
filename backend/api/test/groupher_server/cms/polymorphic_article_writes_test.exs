defmodule GroupherServer.Test.CMS.PolymorphicArticleWritesTest do
  @moduledoc false

  use GroupherServer.TestMate

  alias GroupherServer.CMS
  alias CMS.Model.{AbuseReport, ArticleCollect, ArticleUpvote}

  setup do
    {community, post, _, user} = mock_article(:post, preload: [author: :user])

    {:ok, other_user} = db_insert(:user)

    {:ok, ~m(community post user other_user)a}
  end

  describe "business writes keep polymorphic refs consistent" do
    test "create_comment persists only the matching article ref", ~m(community post user)a do
      {:ok, comment} =
        CMS.Comments.create_comment(community, :post, article_inner_id(post, community), mock_comment(), user, Ecto.UUID.generate())

      {:ok, comment} = ORM.find(Comment, comment.id)

      assert comment.thread == :post
      assert comment.article_id == post.id
      refute Map.has_key?(comment, :post_id)
      refute Map.has_key?(comment, :blog_id)
      refute Map.has_key?(comment, :changelog_id)
      refute Map.has_key?(comment, :doc_id)
    end

    test "upvote persists only the matching article ref", ~m(post user)a do
      {:ok, _post} = CMS.Interactions.upvote(post, user, Ecto.UUID.generate())

      assert {:ok, upvote} =
               ORM.find_by(ArticleUpvote, %{user_id: user.id, thread: :post, article_id: post.id})

      assert upvote.article_id == post.id
      refute Map.has_key?(upvote, :post_id)
      refute Map.has_key?(upvote, :blog_id)
      refute Map.has_key?(upvote, :changelog_id)
      refute Map.has_key?(upvote, :doc_id)
    end

    test "collect persists only the matching article ref", ~m(post user)a do
      {:ok, _collect} = CMS.Interactions.collect(post, user, Ecto.UUID.generate())

      assert {:ok, collect} =
               ORM.find_by(ArticleCollect, %{user_id: user.id, thread: :post, article_id: post.id})

      assert collect.article_id == post.id
      refute Map.has_key?(collect, :post_id)
      refute Map.has_key?(collect, :blog_id)
      refute Map.has_key?(collect, :changelog_id)
      refute Map.has_key?(collect, :doc_id)
    end

    test "article report persists at most one article ref", ~m(post other_user)a do
      {:ok, _post} = CMS.AbuseReports.article(post, "spam", "title", other_user, Ecto.UUID.generate())

      assert {:ok, report} = ORM.find_by(AbuseReport, %{article_id: post.id})

      assert report.article_id == post.id
      refute Map.has_key?(report, :post_id)
      refute Map.has_key?(report, :blog_id)
      refute Map.has_key?(report, :changelog_id)
      refute Map.has_key?(report, :doc_id)
    end
  end
end
