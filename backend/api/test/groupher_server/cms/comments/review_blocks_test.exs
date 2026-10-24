defmodule GroupherServer.Test.CMS.Comments.ReviewBlocksTest do
  @moduledoc false
  use GroupherServer.TestMate, async: false

  import Ecto.Query

  alias GroupherServer.CMS

  alias CMS.Model.{CommentLifecycle, CommentReviewBlock}

  test "single Comment responses filter restricted embedded replies through Gate" do
    {community, article, _article_attrs, parent_author} = mock_article(:post)
    {:ok, reply_author} = db_insert(:user)

    {:ok, parent} =
      CMS.Comments.create_comment(
        community,
        :post,
        article_inner_id(article, community),
        mock_comment("visible parent"),
        parent_author,
        Ecto.UUID.generate()
      )

    {:ok, reply} =
      CMS.Comments.reply_comment(
        parent.id,
        mock_comment("restricted reply"),
        reply_author,
        Ecto.UUID.generate()
      )

    lifecycle = Repo.get_by!(CommentLifecycle, comment_id: reply.id)

    assert {:ok, _restriction} =
             Repo.transaction(fn ->
               locked =
                 CommentLifecycle
                 |> where([row], row.id == ^lifecycle.id)
                 |> lock("FOR UPDATE")
                 |> Repo.one()

               case CMS.Comments.Lifecycle.apply_review_block(
                      locked,
                      restriction_attrs(lifecycle, "platform", "hidden-embedded-reply")
                    ) do
                 {:ok, restriction} -> restriction
                 {:error, reason} -> Repo.rollback(reason)
               end
             end)

    assert {:ok, public_parent} = CMS.Comments.one_comment(parent.id)
    assert public_parent.replies == []

    assert {:ok, reply_author_parent} = CMS.Comments.one_comment(parent.id, reply_author)
    assert Enum.map(reply_author_parent.replies, & &1.id) == [reply.id]
  end

  test "only the author can read a Comment under a platform review restriction" do
    {community, article, _article_attrs, author} = mock_article(:post)
    inner_id = article_inner_id(article, community)

    {:ok, comment} =
      CMS.Comments.create_comment(
        community,
        :post,
        inner_id,
        mock_comment("review-restricted comment"),
        author,
        Ecto.UUID.generate()
      )

    path = %{
      article: %{community: community.slug, thread: :post, inner_id: inner_id},
      inner_id: comment.inner_id
    }

    lifecycle = Repo.get_by!(CommentLifecycle, comment_id: comment.id)

    assert {:ok, restriction} =
             Repo.transaction(fn ->
               locked =
                 CommentLifecycle
                 |> where([row], row.id == ^lifecycle.id)
                 |> lock("FOR UPDATE")
                 |> Repo.one()

               case CMS.Comments.Lifecycle.apply_review_block(
                      locked,
                      restriction_attrs(lifecycle, "platform", "manual-review")
                    ) do
                 {:ok, restriction} -> restriction
                 {:error, reason} -> Repo.rollback(reason)
               end
             end)

    assert {:ok, %{comments_count: 0, comments_participants_count: 0}} =
             CMS.ArticleStats.fetch(:post, comment.article_id)

    assert {:ok, loaded} = CMS.FrontDesk.comment(path, author)
    assert loaded.id == comment.id

    {:ok, platform_reader_user} = db_insert(:user)

    platform_reader = %{
      platform_reader_user
      | cur_passport: %{"global" => %{"review.platform.read" => true}}
    }

    assert {:ok, reviewer_loaded} = CMS.FrontDesk.comment(path, platform_reader)
    assert reviewer_loaded.id == comment.id

    {:ok, community_reader_user} = db_insert(:user)

    community_reader = %{
      community_reader_user
      | cur_passport: %{
          "global" => %{},
          community.slug => %{"cms" => %{"review.read" => true}}
        }
    }

    assert {:error, %ErrorCat.Error{reason: :not_exist}} =
             CMS.FrontDesk.comment(path, community_reader)

    assert {:error, %ErrorCat.Error{reason: :not_exist}} =
             CMS.FrontDesk.comment(path)

    assert {:ok, {:ok, :pass}} =
             Repo.transaction(fn ->
               locked =
                 CommentLifecycle
                 |> where([row], row.id == ^lifecycle.id)
                 |> lock("FOR UPDATE")
                 |> Repo.one()

               CMS.Comments.Lifecycle.end_review_blocks(
                 locked,
                 "platform",
                 [restriction.id],
                 Ecto.UUID.generate(),
                 "review_approved"
               )
             end)

    assert {:ok, %{comments_count: 1, comments_participants_count: 1}} =
             CMS.ArticleStats.fetch(:post, comment.article_id)

    assert {:ok, _loaded} = CMS.FrontDesk.comment(path)
    assert Repo.get!(CommentReviewBlock, restriction.id).version == 2
  end

  defp restriction_attrs(_lifecycle, scope_key, source_ref) do
    %{
      scope_key: scope_key,
      type: :manual_hold,
      source_ref: source_ref,
      source: :human,
      applied_at: DateTime.utc_now(:second)
    }
  end
end
