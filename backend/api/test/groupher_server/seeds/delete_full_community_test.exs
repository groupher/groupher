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
    ArticlePublic,
    ArticleBinding,
    ArticleHistoryOwner,
    AssetReplacementPlan,
    CommunityAsset
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
          comment_replies_range: {1, 1},
          command_id_factory: &Ecto.UUID.generate/0
        )

      post_ids = article_ids(community.id, :post)
      changelog_ids = article_ids(community.id, :changelog)
      doc_ids = article_ids(community.id, :doc)
      ordinary_article_ids = post_ids ++ changelog_ids
      article_ids = ordinary_article_ids ++ doc_ids

      comment_ids =
        Repo.all(
          from(c in Comment,
            where: c.article_id in ^article_ids,
            select: c.id
          )
        )

      ordinary_comment_ids = comment_ids_for(ordinary_article_ids)
      doc_comment_ids = comment_ids_for(doc_ids)

      assert post_ids != []
      assert comment_ids != []

      assert count(from(c in CommunityDashboard, where: c.community_id == ^community.id)) > 0
      assert count(from(c in CommunityTag, where: c.community_id == ^community.id)) > 0
      assert count(from(c in CommentUpvote, where: c.comment_id in ^comment_ids)) > 0
      assert count(from(c in CommentUserEmotion, where: c.comment_id in ^comment_ids)) > 0

      assert count(from(a in ArticleUpvote, where: a.article_id in ^article_ids)) > 0

      assert count(from(a in ArticleUserEmotion, where: a.article_id in ^article_ids)) > 0

      {:ok, seed_bot} = CMS.Seeds.Helper.seed_bot()

      {:ok, from_asset} =
        CMS.Assets.register_to_community(
          community,
          image_asset_attrs("replacement-from.png"),
          seed_bot,
          Ecto.UUID.generate()
        )

      {:ok, to_asset} =
        CMS.Assets.register_to_community(
          community,
          image_asset_attrs("replacement-to.png"),
          seed_bot,
          Ecto.UUID.generate()
        )

      %AssetReplacementPlan{}
      |> AssetReplacementPlan.changeset(%{
        community_id: community.id,
        created_by_id: seed_bot.id,
        from_asset_id: from_asset.id,
        items: [%{"article_id" => List.first(article_ids)}],
        status: :pending,
        to_asset_id: to_asset.id
      })
      |> Repo.insert!()

      assert count(from(plan in AssetReplacementPlan, where: plan.community_id == ^community.id)) ==
               1

      {:ok, :ok} = CMS.Seeds.delete_full_community(slug)

      assert {:error, _} = ORM.find_by(Community, %{slug: slug})

      assert count(from(c in CommunityDashboard, where: c.community_id == ^community.id)) == 0
      assert count(from(c in CommunityTag, where: c.community_id == ^community.id)) == 0
      # Community destroy releases ownership, but ordinary Articles and their discussion
      # history remain after their final Community binding is removed.
      assert count(from(c in Article, where: c.id in ^(post_ids ++ changelog_ids))) ==
               length(ordinary_article_ids)

      assert count(from(c in Article, where: c.id in ^doc_ids)) == 0
      assert count(from(b in ArticleBinding, where: b.community_id == ^community.id)) == 0

      assert count(
               from(owner in ArticleHistoryOwner,
                 where: owner.community_id == ^community.id and owner.article_id in ^article_ids
               )
             ) == 0

      assert count(from(c in ArticlePublic, where: c.article_id in ^doc_ids)) == 0

      assert count(from(c in Comment, where: c.id in ^ordinary_comment_ids)) ==
               length(ordinary_comment_ids)

      assert count(from(c in Comment, where: c.id in ^doc_comment_ids)) == 0
      assert count(from(c in CommentReply, where: c.comment_id in ^ordinary_comment_ids)) > 0
      assert count(from(c in CommentReply, where: c.comment_id in ^doc_comment_ids)) == 0
      assert count(from(c in CommentUpvote, where: c.comment_id in ^ordinary_comment_ids)) > 0
      assert count(from(c in CommentUpvote, where: c.comment_id in ^doc_comment_ids)) == 0

      assert count(from(c in CommentUserEmotion, where: c.comment_id in ^ordinary_comment_ids)) >
               0

      assert count(from(c in CommentUserEmotion, where: c.comment_id in ^doc_comment_ids)) == 0

      assert count(from(a in ArticleUpvote, where: a.article_id in ^ordinary_article_ids)) > 0
      assert count(from(a in ArticleUpvote, where: a.article_id in ^doc_ids)) == 0

      assert count(from(a in ArticleUserEmotion, where: a.article_id in ^ordinary_article_ids)) >
               0

      assert count(from(a in ArticleUserEmotion, where: a.article_id in ^doc_ids)) == 0

      assert count(from(plan in AssetReplacementPlan, where: plan.community_id == ^community.id)) ==
               0

      assert count(from(asset in CommunityAsset, where: asset.community_id == ^community.id)) == 0
    end
  end

  defp count(queryable) do
    {:ok, total_count} = ORM.count(queryable)
    total_count
  end

  defp article_ids(community_id, thread) do
    Repo.all(
      from(article in Article,
        join: binding in CMS.Model.ArticleBinding,
        on: binding.article_id == article.id,
        where: binding.community_id == ^community_id and article.thread == ^thread,
        select: article.id
      )
    )
  end

  defp comment_ids_for(article_ids) do
    Repo.all(
      from(comment in Comment, where: comment.article_id in ^article_ids, select: comment.id)
    )
  end

  defp image_asset_attrs(filename) do
    %{
      filename: filename,
      height: 630,
      mime_type: "image/png",
      size_bytes: 120,
      url: "https://assets.groupher.test/#{filename}",
      width: 1200
    }
  end
end
