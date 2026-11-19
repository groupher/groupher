defmodule GroupherServer.Test.CMS.Articles.DocOwnerConstraintsTest do
  use GroupherServer.TestMate, async: false
  alias GroupherServer.{CMS, Repo}
  alias CMS.Model.ArticleBinding

  setup do
    {owner, doc, _, author} = mock_article(:doc)
    {other, _, _, _} = mock_article(:post)
    {:ok, %{owner: owner, doc: doc, author: author, other: other}}
  end

  test "a Doc can have multiple independent Bindings and retained history", ctx do
    assert {:ok, _binding} =
             Repo.insert(
               ArticleBinding.changeset(%ArticleBinding{}, %{
                 article_id: ctx.doc.article_id,
                 community_id: ctx.other.id
               }),
               mode: :savepoint
             )

    assert Repo.get_by!(CMS.Model.ArticleHistoryOwner,
             article_id: ctx.doc.article_id,
             community_id: ctx.other.id
           )
  end

  test "direct SQL cannot fake a thread, move ownership or delete the owner binding", ctx do
    id = Ecto.UUID.dump!(ctx.doc.article_id)
    rejected("UPDATE cms.article_bindings SET thread='post' WHERE article_id=$1", [id], "23514")

    rejected(
      "UPDATE cms.article_bindings SET community_id=$2 WHERE article_id=$1",
      [id, ctx.other.id],
      "23514"
    )

    assert {:ok, _} =
             Repo.query("DELETE FROM cms.article_bindings WHERE article_id=$1", [id],
               mode: :savepoint
             )
  end

  test "a Community cannot be physically deleted while its stable Doc binding exists", ctx do
    rejected("DELETE FROM cms.communities WHERE id=$1", [ctx.owner.id], "23503")
  end

  test "retained history ownership cannot move to another Community", ctx do
    rejected(
      "UPDATE cms.article_history_owners SET community_id=$2 WHERE article_id=$1",
      [Ecto.UUID.dump!(ctx.doc.article_id), ctx.other.id],
      "23514"
    )
  end

  test "OWNER-06 stable Article history cannot be deleted while its Community is active", ctx do
    rejected(
      "DELETE FROM cms.articles WHERE id=$1",
      [Ecto.UUID.dump!(ctx.doc.article_id)],
      "23503"
    )

    assert Repo.get!(CMS.Model.Article, ctx.doc.article_id)
    assert Repo.get_by!(CMS.Model.ArticleHistoryOwner, article_id: ctx.doc.article_id)
  end

  test "OWNER-03 raw SQL cannot scope a Doc Comment review block to another Community", ctx do
    {:ok, comment} =
      CMS.Comments.create_comment(
        ctx.owner,
        :doc,
        ctx.doc.inner_id,
        mock_comment(),
        ctx.author,
        Ecto.UUID.generate()
      )

    lifecycle = Repo.get_by!(CMS.Model.CommentLifecycle, comment_id: comment.id)

    {:ok, {:ok, block}} =
      Repo.transaction(fn ->
        CMS.ReviewBlocks.apply(lifecycle, %{
          scope_key: "platform",
          type: :human_review_hold,
          source: :request,
          source_ref: "owner-test",
          operation_ref: Ecto.UUID.generate(),
          applied_at: DateTime.utc_now(:second)
        })
      end)

    rejected(
      "UPDATE cms.comment_review_blocks SET community_id=$2 WHERE id=$1",
      [block.id, ctx.other.id],
      "23514"
    )
  end

  defp rejected(sql, params, code) do
    assert {:error, %Postgrex.Error{postgres: postgres}} =
             Repo.query(sql, params, mode: :savepoint)

    assert postgres.pg_code == code
  end
end
