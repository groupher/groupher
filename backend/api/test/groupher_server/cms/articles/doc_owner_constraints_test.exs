defmodule GroupherServer.Test.CMS.Articles.DocOwnerConstraintsTest do
  use GroupherServer.TestMate, async: false
  alias GroupherServer.{CMS, Repo}
  alias CMS.Model.ArticleBinding

  setup do
    {owner, doc, _, author} = mock_article(:doc)
    {other, _, _, _} = mock_article(:post)
    {:ok, %{owner: owner, doc: doc, author: author, other: other}}
  end

  test "the stable owner resolver and database reject a second Doc binding", ctx do
    assert {:ok, owner} = CMS.Articles.Bindings.doc_owner(ctx.doc.article_id)
    assert owner.id == ctx.owner.id

    assert {:error, changeset} =
             Repo.insert(
               ArticleBinding.changeset(%ArticleBinding{}, %{
                 article_id: ctx.doc.article_id,
                 community_id: ctx.other.id
               }),
               mode: :savepoint
             )

    assert changeset.errors[:article_id]
  end

  test "direct SQL cannot fake a thread, move ownership or delete the owner binding", ctx do
    id = Ecto.UUID.dump!(ctx.doc.article_id)
    rejected("UPDATE cms.article_bindings SET thread='post' WHERE article_id=$1", [id], "23514")

    rejected(
      "UPDATE cms.article_bindings SET community_id=$2 WHERE article_id=$1",
      [id, ctx.other.id],
      "23514"
    )

    rejected("DELETE FROM cms.article_bindings WHERE article_id=$1", [id], "23503")
  end

  test "an owner Community cannot be physically deleted while its stable Doc exists", ctx do
    rejected("DELETE FROM cms.communities WHERE id=$1", [ctx.owner.id], "23503")
    assert {:ok, owner} = CMS.Articles.Bindings.doc_owner(ctx.doc.article_id)
    assert owner.id == ctx.owner.id
  end

  test "a Doc cannot join a branch from another Community", ctx do
    branch = Repo.get_by!(CMS.Model.DocBranch, community_id: ctx.other.id, type: :main)

    rejected(
      "INSERT INTO cms.doc_branch_states(article_id,branch_id,inserted_at,updated_at) VALUES ($1,$2,NOW(),NOW())",
      [Ecto.UUID.dump!(ctx.doc.article_id), branch.id],
      "23514"
    )
  end

  test "OWNER-06 deleting the stable Article permits its legitimate binding cascade", ctx do
    assert {:ok, _} = Repo.delete(Repo.get!(CMS.Model.Article, ctx.doc.article_id))
    refute Repo.get_by(ArticleBinding, article_id: ctx.doc.article_id)
    Repo.query!("DELETE FROM review_bot.review_bot_configs WHERE community_id=$1", [ctx.owner.id])

    assert {:ok, %{num_rows: 1}} =
             Repo.query("DELETE FROM cms.communities WHERE id=$1", [ctx.owner.id],
               mode: :savepoint
             )
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
