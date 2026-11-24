defmodule GroupherServer.Test.CMS.DocTree.HistoryPurgeTest do
  use GroupherServer.TestMate, async: false
  alias GroupherServer.CMS

  alias CMS.Model.{
    Article,
    ArticleBody,
    ArticlePublic,
    ArticleSnapshot,
    ArticleWorkingCopy,
    CommunityLifecycle,
    ArticleHistoryOwner,
    DocsPublishQueue,
    DocsQueueArticle
  }

  alias CMS.DocTree.WorkspaceTrashPurge
  alias CMS.DocTree.Commands.{BeginEdit, Enqueue}
  alias CMS.DocTree.Publish.Queue

  test "a failed history deletion rolls back Community destroy and every content change" do
    {community, doc, _, user} = mock_article(:doc)
    {_, ordinary, _, _} = mock_article(:post, community, user)
    {_, other, _, _} = mock_article(:post)

    Repo.insert!(%ArticleHistoryOwner{article_id: ordinary.id, community_id: community.id},
      on_conflict: :nothing
    )

    assert Repo.get_by(ArticleHistoryOwner, article_id: ordinary.id, community_id: community.id)
    public = Repo.get!(ArticlePublic, doc.id)
    snapshot = Repo.get!(ArticleSnapshot, public.snapshot_id)

    assert {:ok, _} =
             CMS.Communities.Lifecycle.request_destroy(community.id,
               recover_until: DateTime.add(DateTime.utc_now(:second), -1, :second),
               operation_ref: Ecto.UUID.generate()
             )

    assert {:ok, _} =
             CMS.Communities.Lifecycle.schedule_destroy(community.id,
               operation_ref: Ecto.UUID.generate()
             )

    Repo.query!("""
    CREATE FUNCTION cms.reject_history_purge_test() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'history purge injected failure'; END $$
    """)

    Repo.query!("""
    CREATE TRIGGER reject_history_purge_test BEFORE DELETE ON cms.doc_publish_releases
    FOR EACH ROW WHEN (OLD.community_id = #{community.id}) EXECUTE FUNCTION cms.reject_history_purge_test()
    """)

    assert_raise Postgrex.Error, ~r/history purge injected failure/, fn ->
      Repo.transaction(
        fn ->
          CMS.Communities.Lifecycle.destroy(community.id, operation_ref: Ecto.UUID.generate())
        end,
        mode: :savepoint
      )
    end

    assert Repo.get_by!(CommunityLifecycle, community_id: community.id).state == :pending_destroy
    assert Repo.get!(ArticlePublic, doc.id).snapshot_id == snapshot.id
    assert Repo.get!(ArticleBody, snapshot.body_id)
    assert Repo.get_by!(ArticleHistoryOwner, article_id: doc.id)
    Repo.query!("DROP TRIGGER reject_history_purge_test ON cms.doc_publish_releases")
    Repo.query!("DROP FUNCTION cms.reject_history_purge_test()")

    assert {:ok, %{state: :destroy}} =
             CMS.Communities.Lifecycle.destroy(community.id, operation_ref: Ecto.UUID.generate())

    refute Repo.get(Article, doc.id)
    refute Repo.get(ArticleSnapshot, snapshot.id)
    refute Repo.get(ArticleBody, snapshot.body_id)
    assert Repo.get!(Article, ordinary.id)
    refute Repo.get_by(ArticleHistoryOwner, article_id: ordinary.id, community_id: community.id)
    assert Repo.get!(Article, other.id)
  end

  test "Community destroy removes Queue members before purging their body history" do
    {community, public, _, actor} = mock_article(:doc)
    doc = Repo.get!(Article, public.id)

    assert {:ok, opened} =
             BeginEdit.execute(community, doc.id, public.snapshot_id, actor, Ecto.UUID.generate())

    work = Repo.get!(ArticleWorkingCopy, opened.working_copy_id)
    assert {:ok, queue} = Queue.read(community)

    assert {:ok, _} =
             Enqueue.execute(
               community,
               queue.queue_revision,
               [%{article_id: doc.id, default_revision: work.revision}],
               actor,
               Ecto.UUID.generate()
             )

    assert {:ok, queue} = Queue.read(community)
    member = Repo.get_by!(DocsQueueArticle, queue_id: queue.id, article_id: doc.id)
    queue_work = Repo.get!(ArticleWorkingCopy, member.working_copy_id)
    assert queue_work.id != work.id

    assert WorkspaceTrashPurge.legacy_queue_references?(queue.id, [doc.id])

    assert {:ok, _} =
             CMS.Communities.Lifecycle.request_destroy(community.id,
               recover_until: DateTime.add(DateTime.utc_now(:second), -1, :second),
               operation_ref: Ecto.UUID.generate()
             )

    assert {:ok, _} =
             CMS.Communities.Lifecycle.schedule_destroy(community.id,
               operation_ref: Ecto.UUID.generate()
             )

    assert {:ok, %{state: :destroy}} =
             CMS.Communities.Lifecycle.destroy(community.id,
               operation_ref: Ecto.UUID.generate()
             )

    refute Repo.get_by(DocsQueueArticle, queue_id: queue.id, article_id: doc.id)
    refute Repo.get(ArticleWorkingCopy, work.id)
    refute Repo.get(ArticleWorkingCopy, queue_work.id)
    refute Repo.get(ArticleSnapshot, public.snapshot_id)
    refute Repo.get(Article, doc.id)
    refute Repo.get(DocsPublishQueue, queue.id)
    assert Repo.get_by!(CommunityLifecycle, community_id: community.id).state == :destroy
  end
end
