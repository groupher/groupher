import ExUnit.Assertions
import Ecto.Query
alias GroupherServer.{CMS, Repo}

alias CMS.Model.{
  Article,
  ArticleBinding,
  ArticleBody,
  ArticlePublic,
  ArticleSnapshot,
  ArticleWorkingCopy,
  CommunityAsset,
  ArticleAssetRef,
  DocsHistoryOwner
}

{_, bindings} = Code.eval_file("scripts/docs_duplicate_r7_verify.exs")
site = Keyword.fetch!(bindings, :site)
actor = Keyword.fetch!(bindings, :actor)
article = Keyword.fetch!(bindings, :article)

alias CMS.DocTree.Publish.Queue
alias CMS.DocTree.Commands.{ConfigureQueue, Enqueue, ApproveQueue, ReleaseQueue}
copy = Keyword.fetch!(bindings, :copy2)
{:ok, queue} = Queue.read(site)

assert {:ok, _} =
         ConfigureQueue.execute(
           site,
           queue.approval_policy_revision,
           true,
           true,
           actor,
           Ecto.UUID.generate()
         )

assert {:ok, queued} =
         Enqueue.execute(
           site,
           queue.queue_revision,
           [%{article_id: copy.article_id, default_revision: copy.revision}],
           actor,
           Ecto.UUID.generate()
         )

assert {:ok, _} = ApproveQueue.execute(site, queued.queue_revision, actor, Ecto.UUID.generate())
assert {:ok, _} = ReleaseQueue.execute(site, queued.queue_revision, actor, Ecto.UUID.generate())
{:ok, queue} = Queue.read(site)

assert {:ok, _} =
         ConfigureQueue.execute(
           site,
           queue.approval_policy_revision,
           false,
           false,
           actor,
           Ecto.UUID.generate()
         )

assert Repo.exists?(from(a in CMS.Model.DocsPublishApproval, where: a.community_id == ^site.id))

# Add retained Snapshot asset membership and an independently published Article.
asset =
  %CommunityAsset{}
  |> CommunityAsset.changeset(%{
    community_id: site.id,
    uploader_id: actor.id,
    url: "https://example.com/#{Ecto.UUID.generate()}.png",
    size_bytes: 10
  })
  |> Repo.insert!()

snapshot = Repo.get!(ArticleSnapshot, Repo.get!(ArticlePublic, article.id).snapshot_id)

Repo.insert!(%ArticleAssetRef{
  community_id: site.id,
  asset_id: asset.id,
  snapshot_id: snapshot.id,
  usage: :attachment
})

assert {:ok, :purged} =
         Repo.transact(fn ->
           assert {:error, :community_destroy_required} =
                    CMS.DocTree.HistoryPurge.run(
                      %CMS.Model.CommunityLifecycle{state: :active, community_id: site.id},
                      Ecto.UUID.generate()
                    )

           {:ok, :purged}
         end)

assert {:ok, %{done: true}} = CMS.Seeds.Docs.delete(site, article.id, actor)
refute Repo.get_by(ArticleBinding, article_id: article.id)
refute Repo.get(ArticlePublic, article.id)
assert Repo.get(Article, article.id)
assert Repo.get(ArticleSnapshot, snapshot.id)
assert Repo.get(ArticleBody, snapshot.body_id)
assert Repo.get(DocsHistoryOwner, article.id)
assert Repo.exists?(from(r in ArticleAssetRef, where: r.snapshot_id == ^snapshot.id))

ids =
  Repo.all(from(o in DocsHistoryOwner, where: o.community_id == ^site.id, select: o.article_id))

others_before =
  Repo.all(from(a in Article, where: a.id not in ^ids, order_by: a.id, select: a.id))

assert {:ok, _} =
         CMS.Communities.Lifecycle.request_destroy(site.id,
           recover_until: DateTime.add(DateTime.utc_now(:second), -1, :second),
           operation_ref: Ecto.UUID.generate()
         )

assert {:ok, _} =
         CMS.Communities.Lifecycle.schedule_destroy(site.id, operation_ref: Ecto.UUID.generate())

assert {:ok, destroyed} =
         CMS.Communities.Lifecycle.destroy(site.id, operation_ref: Ecto.UUID.generate())

assert destroyed.state == :destroy
refute Repo.exists?(from(a in Article, where: a.id in ^ids))
refute Repo.exists?(from(s in ArticleSnapshot, where: s.article_id in ^ids))
refute Repo.exists?(from(b in ArticleBody, where: b.article_id in ^ids))
refute Repo.exists?(from(w in ArticleWorkingCopy, where: w.article_id in ^ids))
refute Repo.exists?(from(r in ArticleAssetRef, where: r.snapshot_id == ^snapshot.id))
assert Repo.get!(CommunityAsset, asset.id).url == asset.url
assert Repo.all(from(a in Article, order_by: a.id, select: a.id)) == others_before

for table <-
      ~w(docs_publish_queues docs_publish_approvals doc_publish_releases doc_tree_snapshots doc_tree_events docs_history_owners) do
  assert [[0]] =
           Repo.query!("SELECT count(*) FROM cms.#{table} WHERE community_id=$1", [site.id]).rows
end

IO.puts(
  "R7 individual purge preserves Snapshot/body/assets/history; Community destroy purges owned history and preserves other Articles and asset objects"
)
