defmodule GroupherServer.Test.Seeds.DeleteFullCommunityTest do
  @moduledoc false
  use GroupherServerWeb.ConnCase, async: false
  @moduletag timeout: 300_000

  import Ecto.Query, warn: false

  alias GroupherServer.{CMS, Repo}
  alias Helper.ORM

  alias CMS.Model.{
    ArticleUpvote,
    ArticleUserEmotion,
    Article,
    Comment,
    CommentReply,
    CommentUpvote,
    CommentUserEmotion,
    Community,
    CommunityDashboard,
    CommunityTag,
    DocPublic
  }

  describe "[delete full community seeds]" do
    test "delete_full_community removes related records" do
      slug = "seed-delete-#{System.unique_integer([:positive, :monotonic])}"

      {:ok, community} =
        CMS.Seeds.full_community(slug,
          tag_count_range: {2, 3},
          article_count_per_thread: 4,
          comment_count_per_article: 4,
          article_upvotes_range: {1, 2},
          comment_upvotes_range: {1, 2},
          comment_replies_range: {1, 1}
        )

      post_ids = article_ids(community.id, :post)
      changelog_ids = article_ids(community.id, :changelog)
      doc_ids = article_ids(community.id, :doc)
      article_ids = post_ids ++ changelog_ids ++ doc_ids

      comment_ids =
        Repo.all(
          from(c in Comment,
            where: c.article_id in ^article_ids,
            select: c.id
          )
        )

      assert post_ids != []
      assert comment_ids != []

      assert count(from(c in CommunityDashboard, where: c.community_id == ^community.id)) > 0
      assert count(from(c in CommunityTag, where: c.community_id == ^community.id)) > 0
      assert count(from(c in CommentUpvote, where: c.comment_id in ^comment_ids)) > 0
      assert count(from(c in CommentUserEmotion, where: c.comment_id in ^comment_ids)) > 0

      assert count(from(a in ArticleUpvote, where: a.article_id in ^article_ids)) > 0

      assert count(from(a in ArticleUserEmotion, where: a.article_id in ^article_ids)) > 0

      {:ok, :ok} = CMS.Seeds.delete_full_community(slug)

      assert {:error, _} = ORM.find_by(Community, %{slug: slug})

      assert count(from(c in CommunityDashboard, where: c.community_id == ^community.id)) == 0
      assert count(from(c in CommunityTag, where: c.community_id == ^community.id)) == 0
      assert count(from(c in Article, where: c.id in ^article_ids)) == 0
      assert count(from(c in DocPublic, where: c.article_id in ^doc_ids)) == 0
      assert count(from(c in Comment, where: c.id in ^comment_ids)) == 0
      assert count(from(c in CommentReply, where: c.comment_id in ^comment_ids)) == 0
      assert count(from(c in CommentUpvote, where: c.comment_id in ^comment_ids)) == 0
      assert count(from(c in CommentUserEmotion, where: c.comment_id in ^comment_ids)) == 0

      assert count(from(a in ArticleUpvote, where: a.article_id in ^article_ids)) == 0

      assert count(from(a in ArticleUserEmotion, where: a.article_id in ^article_ids)) == 0
    end
  end

  defp count(queryable) do
    {:ok, total_count} = ORM.count(queryable)
    total_count
  end

  defp article_ids(community_id, thread) do
    Repo.all(
      from(article in Article,
        where: article.community_id == ^community_id and article.thread == ^thread,
        select: article.id
      )
    )
  end
end
