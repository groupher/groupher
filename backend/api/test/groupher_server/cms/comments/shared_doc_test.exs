defmodule GroupherServer.Test.CMS.Comments.SharedDocTest do
  use GroupherServer.TestMate, async: false
  import Ecto.Query
  alias GroupherServer.{CMS, Repo}
  alias CMS.Model.{Article, ArticleStats, Comment, ArticleHistoryOwner, ArticleLifecycle}

  setup do
    {community, doc, _, author} = mock_article(:doc)
    {:ok, viewer} = db_insert(:user)

    {:ok, %{community: community, doc: doc, author: author, viewer: viewer}}
  end

  test "DOC-01 repeated writes use one stable discussion and number sequence", ctx do
    project = %{id: ctx.doc.id, community: ctx.community}

    {:ok, first} =
      CMS.Comments.Commands.Create.create(
        :doc,
        project,
        mock_comment(),
        ctx.viewer,
        Ecto.UUID.generate()
      )

    {:ok, second} =
      CMS.Comments.Commands.Create.create(
        :doc,
        project,
        mock_comment(),
        ctx.viewer,
        Ecto.UUID.generate()
      )

    assert first.comment.article_id == second.comment.article_id
    assert second.comment.inner_id == first.comment.inner_id + 1
    refute Map.has_key?(first.comment, :branch_id)
    assert Repo.get_by!(ArticleStats, article_id: ctx.doc.id).comments_count == 2
    {:ok, state} = CMS.Comments.comments_state(:doc, ctx.doc.id, nil, ctx.community.slug)
    assert state.total_count == 2
    assert state.participants_count == 1
    assert length(state.participants) == 1

    {:ok, participants} =
      CMS.Comments.paged_comments_participants(
        :doc,
        ctx.doc.id,
        %GroupherServer.Pagi.Params.Offset{page: 1, size: 20},
        ctx.community.slug
      )

    assert Enum.map(participants.entries, & &1.id) == [ctx.viewer.id]
  end

  test "GATE-01 another Community cannot borrow shared summaries or reply identity", ctx do
    {other, _, _, _} = mock_article(:post)
    assert {:error, _} = CMS.Comments.comments_state(:doc, ctx.doc.id, nil, other.slug)

    assert {:error, _} =
             CMS.Comments.paged_comments_participants(:doc, ctx.doc.id, nil, other.slug)

    assert {:error, _} =
             CMS.Comments.Commands.Create.create(
               :doc,
               %{id: ctx.doc.id, community: other},
               mock_comment(),
               ctx.viewer,
               Ecto.UUID.generate()
             )
  end

  test "GATE-01 a deleted Doc does not admit discussion", ctx do
    {:ok, created} =
      CMS.Comments.Commands.Create.create(
        :doc,
        %{id: ctx.doc.id, community: ctx.community},
        mock_comment(),
        ctx.viewer,
        Ecto.UUID.generate()
      )

    Repo.update_all(
      from(l in ArticleLifecycle,
        where: l.article_id == ^ctx.doc.id
      ),
      set: [state: :deleted]
    )

    assert {:error, _} =
             CMS.Comments.comments_state(:doc, ctx.doc.id, ctx.author, ctx.community.slug)

    assert {:error, _} =
             CMS.Comments.Commands.Create.create(
               :doc,
               %{id: ctx.doc.id, community: ctx.community},
               mock_comment(),
               ctx.author,
               Ecto.UUID.generate()
             )

    assert Repo.get!(Comment, created.comment.id)
    assert Repo.get_by!(ArticleStats, article_id: ctx.doc.id).comments_count == 1
  end

  test "DEL-01 purging a Doc preserves its stable discussion and history", ctx do
    {:ok, comment} =
      CMS.Comments.create_comment(
        ctx.community,
        :doc,
        ctx.doc.inner_id,
        mock_comment(),
        ctx.viewer,
        Ecto.UUID.generate()
      )

    actor = ctx.author
    assert {:ok, _} = CMS.Seeds.Docs.delete(ctx.community, ctx.doc.id, actor)

    assert Repo.get!(Article, ctx.doc.id)
    assert Repo.get!(Comment, comment.id)
    assert Repo.get_by!(ArticleStats, article_id: ctx.doc.id).comments_count == 1
    assert Repo.get_by!(ArticleLifecycle, article_id: ctx.doc.id)

    assert Repo.get_by!(ArticleHistoryOwner, article_id: ctx.doc.id).community_id ==
             ctx.community.id

    refute Repo.get_by(CMS.Model.ArticleBinding, article_id: ctx.doc.id)
  end

  test "ACT-02 comment activity and locking belong to the stable Article", ctx do
    epoch = ~U[2026-11-01 00:00:00Z]

    Repo.update_all(from(a in Article, where: a.id == ^ctx.doc.id),
      set: [active_at: epoch]
    )

    {:ok, _} =
      CMS.Comments.Commands.Create.create(
        :doc,
        %{id: ctx.doc.id, community: ctx.community},
        mock_comment(),
        ctx.viewer,
        Ecto.UUID.generate()
      )

    assert DateTime.compare(Repo.get!(Article, ctx.doc.id).active_at, epoch) == :gt

    {:ok, _} =
      CMS.Articles.lock_comments(ctx.doc.id, ctx.author, community: ctx.community)

    assert Repo.get!(Article, ctx.doc.id).comments_locked

    assert {:error, _} =
             CMS.Comments.Commands.Create.create(
               :doc,
               %{id: ctx.doc.id, community: ctx.community},
               mock_comment(),
               ctx.viewer,
               Ecto.UUID.generate()
             )
  end
end
