defmodule GroupherServer.Test.CMS.Comments.ReviewBlocksTest do
  @moduledoc false
  use GroupherServer.TestMate, async: false

  import Ecto.Query

  alias GroupherServer.CMS

  alias CMS.Model.{CommentLifecycle, CommentReviewBlock}
  alias CMS.Outbox.Event, as: OutboxEvent

  test "Comment creation persists a dedicated Mention sync intent with the body watermark" do
    {community, article, _attrs, author} = mock_article(:post)

    assert {:ok, comment} =
             CMS.Comments.create_comment(
               community,
               :post,
               article_inner_id(article, community),
               mock_comment("durable mention intent"),
               author,
               Ecto.UUID.generate()
             )

    assert %OutboxEvent{data: %{"content_token" => token}} =
             Repo.get_by!(OutboxEvent,
               event: "comment.mention_sync",
               resource_id: to_string(comment.id)
             )

    assert String.starts_with?(token, "#{comment.id}:")
  end

  test "creating a shared Comment invalidates every current Article binding" do
    {community, article_view, _attrs, author} = mock_article(:post)
    {:ok, destination} = mock_community(author)
    article = Repo.get!(CMS.Model.Article, article_view.article_id)
    assert {:ok, _binding} = CMS.Articles.BindingPersist.mirror(article, destination)
    command_id = Ecto.UUID.generate()

    assert {:ok, _comment} =
             CMS.Comments.create_comment(
               community,
               :post,
               article_inner_id(article_view, community),
               mock_comment("Shared comment"),
               author,
               command_id
             )

    events =
      Repo.all(
        from(event in OutboxEvent,
          where: event.event == "comment.changed" and event.command_id == ^command_id
        )
      )

    assert MapSet.new(Enum.map(events, & &1.data["community_id"])) ==
             MapSet.new([community.id, destination.id])
  end

  test "database rejects a Community ReviewBlock for an ordinary Comment" do
    {community, article, _attrs, author} = mock_article(:post)

    {:ok, comment} =
      CMS.Comments.create_comment(
        community,
        :post,
        article_inner_id(article, community),
        mock_comment("Global restriction only"),
        author,
        Ecto.UUID.generate()
      )

    lifecycle = Repo.get_by!(CommentLifecycle, comment_id: comment.id)

    assert {:ok, restriction} =
             Repo.transact_result(fn ->
               CMS.Comments.Lifecycle.apply_review_block(
                 lifecycle,
                 restriction_attrs(lifecycle, "platform", "global-only")
               )
             end)

    assert_raise Postgrex.Error, fn ->
      Repo.transaction(fn ->
        Repo.update_all(
          from(block in CommentReviewBlock, where: block.id == ^restriction.id),
          set: [community_id: community.id]
        )
      end)
    end
  end

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

    assert %OutboxEvent{data: effect_data} =
             Repo.get_by!(OutboxEvent,
               event: "article.visibility_changed",
               resource_id: comment.article_id,
               effect_key: "review:#{restriction.source_ref}:#{community.id}"
             )

    assert effect_data["community_id"] == community.id
    assert effect_data["thread"] == "post"

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
