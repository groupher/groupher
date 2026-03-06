defmodule GroupherServer.Test.Seeds.DeleteFullCommunityTest do
  @moduledoc false
  use GroupherServerWeb.ConnCase, async: false
  @moduletag timeout: 300_000

  import Ecto.Query, warn: false

  alias GroupherServer.CMS
  alias GroupherServer.Repo
  alias Helper.ORM

  alias CMS.Model.{
    ArticleUpvote,
    ArticleUserEmotion,
    Changelog,
    Comment,
    CommentReply,
    CommentUpvote,
    CommentUserEmotion,
    Community,
    CommunityDashboard,
    CommunityTag,
    Doc,
    Post
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

      post_ids = Repo.all(from(p in Post, where: p.community_id == ^community.id, select: p.id))

      changelog_ids =
        Repo.all(from(p in Changelog, where: p.community_id == ^community.id, select: p.id))

      doc_ids = Repo.all(from(p in Doc, where: p.community_id == ^community.id, select: p.id))

      comment_ids =
        Repo.all(
          from(c in Comment,
            where:
              c.post_id in ^post_ids or c.changelog_id in ^changelog_ids or c.doc_id in ^doc_ids,
            select: c.id
          )
        )

      assert length(post_ids) > 0
      assert length(comment_ids) > 0

      assert Repo.aggregate(
               from(c in CommunityDashboard, where: c.community_id == ^community.id),
               :count
             ) > 0

      assert Repo.aggregate(
               from(c in CommunityTag, where: c.community_id == ^community.id),
               :count
             ) > 0

      assert Repo.aggregate(from(c in CommentUpvote, where: c.comment_id in ^comment_ids), :count) >
               0

      assert Repo.aggregate(
               from(c in CommentUserEmotion, where: c.comment_id in ^comment_ids),
               :count
             ) > 0

      {:ok, :ok} = CMS.Seeds.delete_full_community(slug)

      assert {:error, _} = ORM.find_by(Community, %{slug: slug})

      assert Repo.aggregate(
               from(c in CommunityDashboard, where: c.community_id == ^community.id),
               :count
             ) == 0

      assert Repo.aggregate(
               from(c in CommunityTag, where: c.community_id == ^community.id),
               :count
             ) == 0

      assert Repo.aggregate(from(c in Post, where: c.id in ^post_ids), :count) == 0
      assert Repo.aggregate(from(c in Changelog, where: c.id in ^changelog_ids), :count) == 0
      assert Repo.aggregate(from(c in Doc, where: c.id in ^doc_ids), :count) == 0
      assert Repo.aggregate(from(c in Comment, where: c.id in ^comment_ids), :count) == 0

      assert Repo.aggregate(from(c in CommentReply, where: c.comment_id in ^comment_ids), :count) ==
               0

      assert Repo.aggregate(from(c in CommentUpvote, where: c.comment_id in ^comment_ids), :count) ==
               0

      assert Repo.aggregate(
               from(c in CommentUserEmotion, where: c.comment_id in ^comment_ids),
               :count
             ) == 0

      assert Repo.aggregate(
               from(a in ArticleUpvote,
                 where:
                   a.post_id in ^post_ids or a.changelog_id in ^changelog_ids or
                     a.doc_id in ^doc_ids
               ),
               :count
             ) == 0

      assert Repo.aggregate(
               from(a in ArticleUserEmotion,
                 where:
                   a.post_id in ^post_ids or a.changelog_id in ^changelog_ids or
                     a.doc_id in ^doc_ids
               ),
               :count
             ) == 0
    end
  end
end
