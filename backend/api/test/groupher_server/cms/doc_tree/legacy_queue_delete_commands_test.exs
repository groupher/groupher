defmodule GroupherServer.Test.CMS.DocTree.LegacyQueueDeleteCommandsTest do
  use GroupherServer.TestMate, async: false

  alias GroupherServer.CMS

  alias CMS.DocTree.Commands.{DeleteWorkspaceNode, Enqueue, PurgeWorkspaceTrash}
  alias CMS.DocTree.Publish.Queue

  alias CMS.Model.{
    ArticlePublic,
    ArticleWorkingCopy,
    DocsPublishQueue,
    DocsQueueArticle,
    DocsTreeNode,
    DocsTrashedArticle,
    DocsTrashedTreeNode,
    TrashAction
  }

  test "DeleteWorkspaceNode dequeues the owned copy before trashing the page and preserves Article history" do
    fixture = doc_with_queue_member()

    node =
      Repo.get_by!(DocsTreeNode,
        community_id: fixture.community.id,
        stage: :draft,
        doc_id: fixture.article_id
      )

    public_before = Repo.get!(ArticlePublic, fixture.article_id)
    work_before = Repo.get!(ArticleWorkingCopy, fixture.work.id)
    snapshot_before = Repo.get!(CMS.Model.ArticleSnapshot, public_before.snapshot_id)

    assert {:ok, result} =
             DeleteWorkspaceNode.execute(
               fixture.community,
               fixture.queue.tree_lock_version,
               fixture.queue.queue_revision,
               node.node_id,
               nil,
               fixture.actor,
               Ecto.UUID.generate()
             )

    assert is_binary(result.trash_action_id)

    refute Repo.get_by(DocsQueueArticle,
             queue_id: fixture.queue.id,
             article_id: fixture.article_id
           )

    refute Repo.get_by(DocsTreeNode,
             community_id: fixture.community.id,
             node_id: node.node_id,
             stage: :draft
           )

    assert Repo.get!(ArticlePublic, fixture.article_id) == public_before
    assert Repo.get!(ArticleWorkingCopy, fixture.work.id) == work_before
    assert Repo.get!(CMS.Model.ArticleSnapshot, public_before.snapshot_id) == snapshot_before

    assert Repo.get!(DocsPublishQueue, fixture.queue.id).queue_revision >
             fixture.queue.queue_revision
  end

  test "PurgeWorkspaceTrash command blocks legacy Q refs before deleting Trash or body refs" do
    fixture = doc_with_queue_member()
    Repo.delete!(Repo.get!(ArticlePublic, fixture.article_id))
    now = DateTime.utc_now(:second)

    action =
      %TrashAction{}
      |> TrashAction.changeset(%{
        community_id: fixture.community.id,
        actor_id: fixture.actor.id,
        root_type: "doc_tree_node",
        root_ref: "legacy-q-trash-root",
        deleted_at: now,
        scheduled_permanent_deletion_at: DateTime.add(now, 30, :day)
      })
      |> Repo.insert!()

    Repo.insert!(
      DocsTrashedArticle.changeset(%DocsTrashedArticle{}, %{
        trash_action_id: action.id,
        community_id: fixture.community.id,
        article_id: fixture.article_id,
        restore_state: :published,
        deleted_by_id: fixture.actor.id,
        deleted_at: now
      })
    )

    Repo.insert!(
      DocsTrashedTreeNode.changeset(%DocsTrashedTreeNode{}, %{
        trash_action_id: action.id,
        community_id: fixture.community.id,
        node_id: "legacy-q-trash-root",
        doc_id: fixture.article_id,
        type: :page,
        draft_snapshot: %{"title" => "Legacy queue page", "index" => 0},
        deleted_by_id: fixture.actor.id,
        deleted_at: now
      })
    )

    assert {:error, %{reason: :docs_trash_in_use}} =
             PurgeWorkspaceTrash.execute(
               fixture.community,
               fixture.queue.queue_revision,
               action.hash_id,
               fixture.actor,
               Ecto.UUID.generate()
             )

    assert Repo.get_by!(DocsQueueArticle,
             queue_id: fixture.queue.id,
             article_id: fixture.article_id
           ) == fixture.member

    assert Repo.get!(ArticleWorkingCopy, fixture.work.id) == fixture.work
    assert Repo.get!(CMS.Model.ArticleSnapshot, fixture.member.source_snapshot_id)
    assert Repo.get_by!(TrashAction, id: action.id)
  end

  defp doc_with_queue_member do
    {community, public, _, actor} = mock_article(:doc)
    article_id = public.id

    assert {:ok, opened} =
             CMS.DocTree.Commands.BeginEdit.execute(
               community,
               article_id,
               public.snapshot_id,
               actor,
               Ecto.UUID.generate()
             )

    work = Repo.get!(ArticleWorkingCopy, opened.working_copy_id)

    assert {:ok, queue} = Queue.read(community)

    assert {:ok, _} =
             Enqueue.execute(
               community,
               queue.queue_revision,
               [%{article_id: article_id, default_revision: work.revision}],
               actor,
               Ecto.UUID.generate()
             )

    assert {:ok, queue} = Queue.read(community)
    member = Repo.get_by!(DocsQueueArticle, queue_id: queue.id, article_id: article_id)

    %{
      community: community,
      actor: actor,
      article_id: article_id,
      work: work,
      queue: queue,
      member: member
    }
  end
end
