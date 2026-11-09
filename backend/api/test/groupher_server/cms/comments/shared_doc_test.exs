defmodule GroupherServer.Test.CMS.Comments.SharedDocTest do
  use GroupherServer.TestMate, async: false
  import Ecto.Query
  alias GroupherServer.{CMS, Repo}
  alias CMS.Model.{Article, ArticleStats, Comment, DocBranch, DocLifecycle}

  setup do
    {community, doc, _, author} = mock_article(:doc)
    {:ok, viewer} = db_insert(:user)

    preview =
      %DocBranch{}
      |> DocBranch.changeset(%{
        community_id: community.id,
        slug: "preview-shared-comments",
        title: "Preview",
        type: :preview,
        status: :active,
        source_branch_id: doc.branch_id,
        created_by_id: author.id
      })
      |> Repo.insert!()

    {:ok, %{community: community, doc: doc, author: author, viewer: viewer, preview: preview}}
  end

  test "DOC-01 body branch projections create one stable discussion and number sequence", ctx do
    project = fn branch ->
      %{id: ctx.doc.article_id, branch_id: branch, community: ctx.community}
    end

    {:ok, first} =
      CMS.Comments.Commands.Create.create(
        :doc,
        project.(ctx.doc.branch_id),
        mock_comment(),
        ctx.viewer,
        Ecto.UUID.generate()
      )

    {:ok, second} =
      CMS.Comments.Commands.Create.create(
        :doc,
        project.(ctx.preview.id),
        mock_comment(),
        ctx.viewer,
        Ecto.UUID.generate()
      )

    assert first.comment.article_id == second.comment.article_id
    assert second.comment.inner_id == first.comment.inner_id + 1
    refute Map.has_key?(first.comment, :branch_id)
    assert Repo.get_by!(ArticleStats, article_id: ctx.doc.article_id).comments_count == 2
    {:ok, state} = CMS.Comments.comments_state(:doc, ctx.doc.article_id, nil, ctx.community.slug)
    assert state.total_count == 2
    assert state.participants_count == 1
    assert length(state.participants) == 1

    {:ok, participants} =
      CMS.Comments.paged_comments_participants(
        :doc,
        ctx.doc.article_id,
        %GroupherServer.Pagi.Params.Offset{page: 1, size: 20},
        ctx.community.slug
      )

    assert Enum.map(participants.entries, & &1.id) == [ctx.viewer.id]
  end

  test "GATE-01 another Community cannot borrow shared summaries or reply identity", ctx do
    {other, _, _, _} = mock_article(:post)
    assert {:error, _} = CMS.Comments.comments_state(:doc, ctx.doc.article_id, nil, other.slug)

    assert {:error, _} =
             CMS.Comments.paged_comments_participants(:doc, ctx.doc.article_id, nil, other.slug)

    assert {:error, _} =
             CMS.Comments.Commands.Create.create(
               :doc,
               %{id: ctx.doc.article_id, branch_id: ctx.preview.id, community: other},
               mock_comment(),
               ctx.viewer,
               Ecto.UUID.generate()
             )
  end

  test "GATE-01 a readable preview does not admit discussion without a published main", ctx do
    {:ok, created} =
      CMS.Comments.Commands.Create.create(
        :doc,
        %{id: ctx.doc.article_id, branch_id: ctx.preview.id, community: ctx.community},
        mock_comment(),
        ctx.viewer,
        Ecto.UUID.generate()
      )

    Repo.update_all(
      from(l in DocLifecycle,
        where: l.article_id == ^ctx.doc.article_id and l.branch_id == ^ctx.doc.branch_id
      ),
      set: [state: :deleted]
    )

    assert {:error, _} =
             CMS.Comments.comments_state(:doc, ctx.doc.article_id, ctx.author, ctx.community.slug)

    assert {:error, _} =
             CMS.Comments.Commands.Create.create(
               :doc,
               %{id: ctx.doc.article_id, branch_id: ctx.preview.id, community: ctx.community},
               mock_comment(),
               ctx.author,
               Ecto.UUID.generate()
             )

    assert Repo.get!(Comment, created.comment.id)
    assert Repo.get_by!(ArticleStats, article_id: ctx.doc.article_id).comments_count == 1
  end

  test "DEL-01 purging the last body branch preserves the stable discussion", ctx do
    {:ok, comment} =
      CMS.Comments.create_comment(
        ctx.community,
        :doc,
        ctx.doc.inner_id,
        mock_comment(),
        ctx.viewer,
        Ecto.UUID.generate()
      )

    branch = Repo.get!(DocBranch, ctx.doc.branch_id)

    {:ok, action} =
      CMS.Docs.Trash.create_action(ctx.community, ctx.author, %{
        root_type: :article,
        root_ref: ctx.doc.article_id
      })

    {:ok, item} =
      CMS.Docs.Trash.attach(action, ctx.community, branch, ctx.doc.article_id, ctx.author)

    assert {:ok, :done} =
             CMS.Docs.Trash.permanently_delete(item, ctx.community, branch, ctx.author, [])

    assert Repo.get!(Article, ctx.doc.article_id)
    assert Repo.get!(Comment, comment.id)
    assert Repo.get_by!(ArticleStats, article_id: ctx.doc.article_id).comments_count == 1
    refute Repo.exists?(from(l in DocLifecycle, where: l.article_id == ^ctx.doc.article_id))
    assert {:ok, %{id: owner_id}} = CMS.Articles.Bindings.doc_owner(ctx.doc.article_id)
    assert owner_id == ctx.community.id
  end

  test "ACT-02 comment activity and locking belong to the stable Article", ctx do
    epoch = ~U[2026-11-01 00:00:00Z]

    Repo.update_all(from(a in Article, where: a.id == ^ctx.doc.article_id),
      set: [active_at: epoch]
    )

    {:ok, _} =
      CMS.Comments.Commands.Create.create(
        :doc,
        %{id: ctx.doc.article_id, branch_id: ctx.preview.id, community: ctx.community},
        mock_comment(),
        ctx.viewer,
        Ecto.UUID.generate()
      )

    assert DateTime.compare(Repo.get!(Article, ctx.doc.article_id).active_at, epoch) == :gt

    {:ok, _} =
      CMS.Articles.lock_comments(ctx.doc.article_id, ctx.author,
        community: ctx.community,
        branch_id: ctx.preview.id
      )

    assert Repo.get!(Article, ctx.doc.article_id).comments_locked

    assert {:error, _} =
             CMS.Comments.Commands.Create.create(
               :doc,
               %{id: ctx.doc.article_id, branch_id: ctx.doc.branch_id, community: ctx.community},
               mock_comment(),
               ctx.viewer,
               Ecto.UUID.generate()
             )
  end
end
