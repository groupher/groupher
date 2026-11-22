# Run after the disposable B0 history tables have been given their target names.
import Ecto.Query
import ExUnit.Assertions
import GroupherServer.Support.Factory

alias GroupherServer.{CMS, Repo}
alias CMS.Articles.WorkingCopy.{Snapshotter, Store}

alias CMS.DocTree.Publish.{
  AlignDefault,
  Approval,
  Plan,
  PublicTree,
  Queue,
  QueueRelease,
  Release,
  SelectPublic
}

alias CMS.Model.{
  Article,
  ArticleBinding,
  ArticlePublic,
  ArticleWorkingCopy,
  Author,
  DocsPublishApprovalArticle,
  DocsPublishApprovalContributor,
  DocsLifecycle,
  DocsRelease,
  DocsReleaseArticle,
  DocsReleaseTreeSnapshot,
  DocsTreeNode
}

[[database]] = Repo.query!("SELECT current_database()").rows
expected = System.get_env("DOCS_B0_DISPOSABLE_DATABASE")

unless Mix.env() == :test and is_binary(expected) and expected == database and
         String.starts_with?(database, "groupher_docs_b0_") do
  raise "Docs Release exercise requires an explicitly named disposable test database"
end

{:ok, actor} = db_insert(:user)
site_name = "release-" <> Ecto.UUID.generate()
{:ok, site} = db_insert(:community, title: site_name, aka: site_name, slug: site_name)
author = Repo.insert!(%Author{user_id: actor.id})
{:ok, queue} = Repo.transact(fn -> Queue.lock_or_create(site) end)

json =
  Jason.encode!([
    %{
      "id" => "p",
      "type" => "p",
      "children" => [
        %{
          "type" => "a",
          "url" => "https://example.com/docs",
          "children" => [%{"text" => "Content"}]
        }
      ]
    }
  ])

body = %{
  json: json,
  markdown: "Content",
  html: "<p>Content</p>",
  toc: [],
  plain_text: "Content",
  digest: "Content",
  body_hash: :crypto.hash(:sha256, json) |> Base.encode16(case: :lower),
  schema_version: 2,
  thumbnail: %{version: 1, blocks: [%{type: "paragraph", text: "Content"}]}
}

assert {:error, :transaction_required} =
         CMS.Docs.Content.create_workspace(site, %{title: "Doc", body_bag: body}, actor)

assert {:ok, %{article: editable_doc, working_copy: editable_work}} =
         Repo.transact(fn ->
           CMS.Docs.Content.create_workspace(site, %{title: "Editable", body_bag: body}, actor)
         end)

assert {:ok, %{revision: 2, title: "Saved through Article"}} =
         CMS.Articles.Commands.SaveWorkingCopy.execute(
           editable_doc,
           site,
           editable_work.id,
           %{title: "Saved through Article"},
           1,
           actor,
           Ecto.UUID.generate()
         )

assert {:error, :creation_rollback} =
         Repo.transaction(fn ->
           assert {:ok, %{article: rolled_back}} =
                    CMS.Docs.Content.create_workspace(
                      site,
                      %{title: "Doc", body_bag: body},
                      actor
                    )

           send(self(), {:rolled_back_article, rolled_back.id})
           Repo.rollback(:creation_rollback)
         end)

assert_receive {:rolled_back_article, rolled_back_id}
refute Repo.get(Article, rolled_back_id)
refute Repo.get_by(DocsLifecycle, article_id: rolled_back_id)
refute Repo.get_by(ArticleWorkingCopy, article_id: rolled_back_id)

assert {:ok, %{article: article, working_copy: default, lifecycle: lifecycle}} =
         Repo.transact(fn ->
           CMS.Docs.Content.create_workspace(site, %{title: "Doc", body_bag: body}, actor)
         end)

assert default.scope_kind == :default and default.scope_id == article.id
assert lifecycle.default_working_copy_id == default.id and lifecycle.state == :draft

public_scope = fn ->
  CMS.Gate.scope(Article, nil, :read, CMS.Gate.Context.Scope.Doc.public())
  |> where([a], a.id == ^article.id)
end

refute Repo.exists?(public_scope.())

gate_identity = %{id: article.id, thread: :doc, community: site}
assert {:ok, %Article{id: id}} = CMS.Gate.access_check(actor, :edit, gate_identity)
assert id == article.id

assert {:error, %CMS.Gate.Decision{allowed: false}} =
         CMS.Gate.access_check(nil, :read, gate_identity)

assert {:error, :enqueue_lifecycle_rollback} =
         Repo.transaction(fn ->
           {:ok, _} = lifecycle |> DocsLifecycle.changeset(%{state: :deleted}) |> Repo.update()

           assert {:error, :doc_lifecycle_not_publishable} =
                    Queue.enqueue(
                      site,
                      queue,
                      0,
                      [%{article_id: article.id, default_revision: 1}],
                      actor,
                      Ecto.UUID.generate()
                    )

           Repo.rollback(:enqueue_lifecycle_rollback)
         end)

assert {:ok, %{members: [member]}} =
         Repo.transact(fn ->
           Queue.enqueue(
             site,
             queue,
             0,
             [%{article_id: article.id, default_revision: 1}],
             actor,
             Ecto.UUID.generate()
           )
         end)

node = fn id, type, parent, doc ->
  %{
    node_id: id,
    type: type,
    parent_node_id: parent,
    index: 0,
    title: id,
    href: nil,
    doc_id: doc,
    marker: nil,
    badge: nil,
    hidden: false
  }
end

target = [
  node.("tab", :tab, nil, nil),
  node.("group", :group, "tab", nil),
  node.("page", :page, "group", article.id)
]

changes =
  Enum.map(
    target,
    &%{node_id: &1.node_id, change_kind: :upsert, target: Map.delete(&1, :node_id)}
  )

assert {:ok, %{queue: %{queue_revision: 2}}} =
         Repo.transact(fn ->
           Queue.reconcile_tree(site, queue, 1, [], target, actor)
         end)

assert {:error, %CMS.Gate.Decision{allowed: false}} = CMS.docs_publish_queue(site, actor)

preview_actor = %{
  actor
  | cur_passport: %{
      "global" => %{},
      site.slug => %{"cms" => %{"doc.queue.preview" => true}}
    }
}

assert {:ok,
        %{revision: 2, articles: [%{article_id: queued_id}], tree_changes: queued_tree_changes}} =
         CMS.docs_publish_queue(site, preview_actor)

assert queued_id == article.id and length(queued_tree_changes) == 3

{:ok, outside_user} = db_insert(:user)
outside_user = %{outside_user | cur_passport: preview_actor.cur_passport}
assert {:error, %CMS.Gate.Decision{allowed: false}} = CMS.docs_publish_queue(site, outside_user)

queue_query = """
query DocsQueue($community: String!) {
  docsPublishQueue(community: $community) {
    revision
    articles { articleId workingCopyId revision title }
    treeChanges { nodeId changeKind }
  }
}
"""

assert {:ok, %{data: %{"docsPublishQueue" => %{"revision" => 2, "articles" => [_]}}}} =
         Absinthe.run(queue_query, GroupherServerWeb.Schema,
           variables: %{"community" => site.slug},
           context: %{cur_user: preview_actor}
         )

assert {:ok, plan} =
         Plan.build(
           nil,
           [],
           changes,
           [%{article_id: article.id, working_copy_id: member.working_copy_id, revision: 1}],
           []
         )

assert {:error, :invalid_approval_lifecycle_rollback} =
         Repo.transaction(fn ->
           {:ok, _} = Queue.set_policy(site, queue, 0, true, false)
           current_lifecycle = Repo.get_by!(DocsLifecycle, article_id: article.id)

           {:ok, _} =
             current_lifecycle |> DocsLifecycle.changeset(%{state: :deleted}) |> Repo.update()

           assert {:error, :doc_lifecycle_not_publishable} =
                    Approval.approve(site, queue, 2, actor, Ecto.UUID.generate())

           Repo.rollback(:invalid_approval_lifecycle_rollback)
         end)

assert {:error, :approval_fixture_rollback} =
         Repo.transaction(fn ->
           {:ok, _} = Queue.set_policy(site, queue, 0, true, false)

           assert {:error, :docs_self_approval_forbidden} =
                    Approval.approve(site, queue, 2, actor, Ecto.UUID.generate())

           {:ok, approver} = db_insert(:user)

           assert {:ok, %{approval: approval, plan: approved_plan}} =
                    Approval.approve(site, queue, 2, approver, Ecto.UUID.generate())

           assert approval.sealed and approved_plan.payload == plan.payload

           assert Repo.query!(
                    "SELECT column_name FROM information_schema.columns WHERE table_schema='cms' AND table_name IN ('docs_publish_approvals','doc_publish_releases') AND column_name IN ('plan_hash','hash_algorithm')"
                  ).rows == []

           assert Approval.matches_sources?(approval, plan)

           for {field, value} <- [
                 {"base_release_id", 99},
                 {"articles", []},
                 {"tree_operations", []},
                 {"unknown", nil}
               ] do
             changed_plan = %{plan | payload: Map.put(plan.payload, field, value)}
             refute Plan.matches?(approval.tree_plan, changed_plan)

             assert {:error, :docs_approval_required} =
                      Release.validate_approval(
                        Repo.get!(CMS.Model.DocsPublishQueue, queue.id),
                        changed_plan,
                        %{},
                        approval.id
                      )
           end

           changed_sources = put_in(plan, [:payload, "articles", Access.at(0), "revision"], 2)
           refute Approval.matches_sources?(approval, changed_sources)

           assert {:error, :docs_approval_required} =
                    Release.validate_approval(
                      Repo.get!(CMS.Model.DocsPublishQueue, queue.id),
                      changed_sources,
                      %{},
                      approval.id
                    )

           approval_member =
             Repo.get_by!(DocsPublishApprovalArticle,
               approval_id: approval.id,
               article_id: article.id
             )

           snapshot = Repo.get!(CMS.Model.ArticleSnapshot, approval_member.snapshot_id)

           assert {:ok, _} =
                    SelectPublic.select(
                      site,
                      queue,
                      2,
                      article.id,
                      1,
                      snapshot.id,
                      nil,
                      actor,
                      DateTime.utc_now(:second)
                    )

           assert {:ok, _} = AlignDefault.align(site, queue, 2, article.id, 1, snapshot.id, actor)
           publication = %{article_id: article.id, snapshot_id: snapshot.id, work_revision: 1}

           assert {:error, :docs_approval_required} =
                    Release.record(
                      site,
                      queue,
                      2,
                      plan,
                      [publication],
                      [],
                      nil,
                      actor,
                      DateTime.utc_now(:second)
                    )

           assert {:error, :docs_approval_required} =
                    Release.record(
                      site,
                      queue,
                      2,
                      plan,
                      [%{publication | snapshot_id: Ecto.UUID.generate()}],
                      [],
                      approval.id,
                      actor,
                      DateTime.utc_now(:second)
                    )

           assert {:ok, %{release: %{approval_id: id}}} =
                    Release.record(
                      site,
                      queue,
                      2,
                      plan,
                      [publication],
                      [],
                      approval.id,
                      actor,
                      DateTime.utc_now(:second)
                    )

           assert id == approval.id
           Repo.rollback(:approval_fixture_rollback)
         end)

assert {:error, :approved_core_rollback} =
         Repo.transaction(fn ->
           assert {:ok, _} = Queue.set_policy(site, queue, 0, true, false)
           {:ok, approver} = db_insert(:user)

           assert {:ok, %{approval: approval}} =
                    Approval.approve(site, queue, 2, approver, Ecto.UUID.generate())

           snapshot_id =
             Repo.get_by!(DocsPublishApprovalArticle,
               approval_id: approval.id,
               article_id: article.id
             ).snapshot_id

           assert {:ok, %{release: release, publications: [publication]}} =
                    QueueRelease.run(site, queue, 2, actor, Ecto.UUID.generate())

           assert release.approval_id == approval.id and publication.snapshot_id == snapshot_id
           Repo.rollback(:approved_core_rollback)
         end)

assert {:error, :multiauthor_rollback} =
         Repo.transaction(fn ->
           {:ok, editor} = db_insert(:user)
           {:ok, approver} = db_insert(:user)
           assert {:ok, _} = Queue.set_policy(site, queue, 0, true, false)
           assert {:ok, _} = Queue.save(site, queue, 2, article.id, 1, %{title: "Edited"}, editor)

           assert {:error, :docs_self_approval_forbidden} =
                    Approval.approve(site, queue, 3, actor, Ecto.UUID.generate())

           assert {:error, :docs_self_approval_forbidden} =
                    Approval.approve(site, queue, 3, editor, Ecto.UUID.generate())

           assert {:ok, %{approval: approval}} =
                    Approval.approve(site, queue, 3, approver, Ecto.UUID.generate())

           authors =
             Repo.all(
               from(c in DocsPublishApprovalContributor,
                 where: c.approval_id == ^approval.id,
                 select: c.user_id
               )
             )
             |> Enum.sort()

           assert authors == Enum.sort([actor.id, editor.id])
           Repo.rollback(:multiauthor_rollback)
         end)

assert {:error, :release_rollback} =
         Repo.transaction(fn ->
           {:ok, snapshot} =
             Snapshotter.freeze_in_transaction(
               member.working_copy_id,
               1,
               actor,
               Ecto.UUID.generate()
             )

           assert {:ok, _} =
                    SelectPublic.select(
                      site,
                      queue,
                      2,
                      article.id,
                      1,
                      snapshot.id,
                      nil,
                      actor,
                      DateTime.utc_now(:second)
                    )

           assert {:ok, _} = AlignDefault.align(site, queue, 2, article.id, 1, snapshot.id, actor)
           assert {:ok, _} = PublicTree.apply(site, queue, 2, plan)
           publication = %{article_id: article.id, snapshot_id: snapshot.id, work_revision: 1}

           assert {:error, :invalid_docs_release_plan} =
                    Release.record(
                      site,
                      queue,
                      2,
                      %{plan | payload: Map.put(plan.payload, "base_release_id", 99)},
                      [publication],
                      [],
                      nil,
                      actor,
                      DateTime.utc_now(:second)
                    )

           for invalid <- [
                 %{plan | format_version: 2},
                 %{plan | target: []},
                 %{plan | payload: Map.put(plan.payload, "unknown", nil)},
                 %{plan | payload: Map.put(plan.payload, "tree_operations", [])},
                 put_in(plan, [:payload, "tree_operations", Access.at(0), :before], %{})
               ] do
             assert {:error, :invalid_docs_release_plan} =
                      Release.record(
                        site,
                        queue,
                        2,
                        invalid,
                        [publication],
                        [],
                        nil,
                        actor,
                        DateTime.utc_now(:second)
                      )
           end

           for invalid <- [
                 put_in(plan, [:payload, "articles"], []),
                 put_in(plan, [:payload, "articles", Access.at(0), "revision"], 1.0),
                 put_in(
                   plan,
                   [:payload, "articles", Access.at(0), "working_copy_id"],
                   Ecto.UUID.generate()
                 )
               ] do
             assert {:error, :docs_release_plan_members_mismatch} =
                      Release.record(
                        site,
                        queue,
                        2,
                        invalid,
                        [publication],
                        [],
                        nil,
                        actor,
                        DateTime.utc_now(:second)
                      )
           end

           assert {:ok, %{release: release, tree_snapshot: tree}} =
                    Release.record(
                      site,
                      queue,
                      2,
                      plan,
                      [publication],
                      [],
                      nil,
                      actor,
                      DateTime.utc_now(:second)
                    )

           assert release.sealed and release.queue_revision == 2
           assert tree.tree_json["version"] == 1

           assert Repo.get_by!(DocsReleaseArticle, release_id: release.id, article_id: article.id).snapshot_id ==
                    snapshot.id

           lifecycle = Repo.get_by!(DocsLifecycle, article_id: article.id)

           assert {:ok, _} =
                    CMS.DocTree.Publish.Lifecycle.published(
                      lifecycle,
                      true,
                      DateTime.utc_now(:second)
                    )

           assert {:ok,
                   %{
                     queue: %{queue_revision: 3, public_presentation_revision: 1},
                     tree_changes_consumed: 3
                   }} =
                    Queue.consume_release(site, queue, 2, release.id, [publication])

           Repo.rollback(:release_rollback)
         end)

assert {:ok, %{queue_revision: 2, public_release_id: nil}} = Queue.read(site)
assert Repo.get(ArticlePublic, article.id) == nil
assert Repo.get(ArticleWorkingCopy, member.working_copy_id)
refute Repo.get_by(CMS.Model.Mentions.Endpoint, type: :doc, article_id: article.id)

assert %{state: :draft, version: 1, first_published_at: nil} =
         Repo.get_by!(DocsLifecycle, article_id: article.id)

assert Repo.get_by!(ArticleBinding, article_id: article.id, community_id: site.id).inner_id == nil
assert Repo.get_by(CMS.Model.ArticleStats, article_id: article.id, thread: :doc) == nil

assert Repo.aggregate(
         from(n in DocsTreeNode, where: n.community_id == ^site.id and n.stage == :public),
         :count
       ) == 0

assert Repo.aggregate(from(r in DocsRelease, where: r.community_id == ^site.id), :count) == 0

assert Repo.aggregate(
         from(t in DocsReleaseTreeSnapshot, where: t.community_id == ^site.id),
         :count
       ) == 0

{:ok, unauthorized_publisher} = db_insert(:user)

assert {:error, %CMS.Gate.Decision{allowed: false}} =
         Repo.transact(fn ->
           QueueRelease.run(site, queue, 2, unauthorized_publisher, Ecto.UUID.generate())
         end)

assert Repo.get(ArticlePublic, article.id) == nil
assert {:ok, %{queue_revision: 2}} = Queue.read(site)

assert {:error, :invalid_lifecycle_rollback} =
         Repo.transaction(fn ->
           lifecycle = Repo.get_by!(DocsLifecycle, article_id: article.id)
           {:ok, _} = lifecycle |> DocsLifecycle.changeset(%{state: :deleted}) |> Repo.update()

           assert {:error, :doc_lifecycle_not_publishable} =
                    QueueRelease.run(site, queue, 2, actor, Ecto.UUID.generate())

           Repo.rollback(:invalid_lifecycle_rollback)
         end)

assert {:error, :core_rollback} =
         Repo.transaction(fn ->
           assert {:ok, %{queue: %{queue_revision: 3}}} =
                    QueueRelease.run(site, queue, 2, actor, Ecto.UUID.generate())

           Repo.rollback(:core_rollback)
         end)

assert {:ok, %{queue_revision: 2, public_release_id: nil}} = Queue.read(site)
assert Repo.get(ArticlePublic, article.id) == nil
assert Repo.get(ArticleWorkingCopy, member.working_copy_id)

assert %{state: :draft, version: 1, first_published_at: nil} =
         Repo.get_by!(DocsLifecycle, article_id: article.id)

assert {:error, _} =
         CMS.DocTree.Commands.ReleaseQueue.execute(site, 2, actor, Ecto.UUID.generate())

assert Repo.get(ArticlePublic, article.id) == nil

assert {:ok, _} =
         CMS.Passport.stamp_passport(
           %{"global" => %{}, site.slug => %{"cms" => %{"doc.queue.publish" => true}}},
           actor
         )

release_command_id = Ecto.UUID.generate()

release_mutation = """
mutation ReleaseDocsQueue($community: String!, $queueRevision: Int!, $commandId: ID!) {
  releaseDocsQueue(community: $community, queueRevision: $queueRevision, commandId: $commandId) {
    releaseId
    queueRevision
  }
}
"""

assert {:ok,
        %{
          data: %{"releaseDocsQueue" => %{"releaseId" => release_id_string, "queueRevision" => 3}}
        }} =
         Absinthe.run(release_mutation, GroupherServerWeb.Schema,
           variables: %{
             "community" => site.slug,
             "queueRevision" => 2,
             "commandId" => release_command_id
           },
           context: %{cur_user: actor}
         )

release_id = String.to_integer(release_id_string)
command_result = %{release_id: release_id, queue_revision: 3}

assert {:ok, ^command_result} =
         CMS.DocTree.Commands.ReleaseQueue.execute(site, 2, actor, release_command_id)

assert {:error, _} =
         CMS.DocTree.Commands.ReleaseQueue.execute(site, 3, actor, release_command_id)

assert Repo.aggregate(from(r in DocsRelease, where: r.community_id == ^site.id), :count) == 1

release = Repo.get!(DocsRelease, release_id)
publication = Repo.get_by!(DocsReleaseArticle, release_id: release.id, article_id: article.id)

snapshot = Repo.get!(CMS.Model.ArticleSnapshot, publication.snapshot_id)

assert {:ok, %{queue_revision: 3, public_presentation_revision: 1, public_release_id: release_id}} =
         Queue.read(site)

assert release_id == release.id
assert Repo.get!(ArticlePublic, article.id).snapshot_id == snapshot.id
assert Repo.exists?(public_scope.())

assert {:ok, %{tabs: [%{groups: [%{pages: [%{doc_id: tree_doc_id, href: href}]}]}]}} =
         CMS.DocTree.read_public(site)

assert tree_doc_id == article.id and href =~ "/doc/"
assert {:ok, %Article{id: id}} = CMS.Gate.access_check(nil, :read, gate_identity)
assert id == article.id

comment =
  Repo.insert!(%CMS.Model.Comment{
    article_id: article.id,
    author_id: actor.id,
    thread: :doc,
    inner_id: 1
  })

Repo.insert!(%CMS.Model.CommentLifecycle{
  comment_id: comment.id,
  state: :visible,
  version: 1,
  changed_at: DateTime.utc_now(:second)
})

comment_scope = fn context ->
  CMS.Gate.scope(CMS.Model.Comment, nil, :read, context)
  |> where([c], c.id == ^comment.id)
end

doc_comments = CMS.Gate.Context.Scope.Comment.for_thread(:doc, community_id: site.id)
all_comments = CMS.Gate.Context.Scope.Comment.all_public()
assert Repo.exists?(comment_scope.(doc_comments))
assert Repo.exists?(comment_scope.(all_comments))
assert {:ok, %CMS.Model.Comment{id: comment_id}} = CMS.Gate.access_check(actor, :edit, comment)
assert comment_id == comment.id

assert {:error, :review_hold_rollback} =
         Repo.transaction(fn ->
           Repo.insert!(%CMS.Model.ArticleReviewBlock{
             article_id: article.id,
             community_id: site.id,
             type: :ai_suspect_hold,
             source_ref: "scope-test",
             source: :request,
             applied_at: DateTime.utc_now(:second)
           })

           refute Repo.exists?(public_scope.())
           assert {:ok, %{tabs: []}} = CMS.DocTree.read_public(site)

           refute Repo.exists?(comment_scope.(doc_comments))
           refute Repo.exists?(comment_scope.(all_comments))

           assert {:error, %CMS.Gate.Decision{allowed: false}} =
                    CMS.Gate.access_check(nil, :read, gate_identity)

           Repo.rollback(:review_hold_rollback)
         end)

assert Repo.exists?(public_scope.())
assert %DateTime{} = Repo.get!(Article, article.id).active_at

assert {:error, :community_restriction_rollback} =
         Repo.transaction(fn ->
           community_lifecycle = Repo.get_by!(CMS.Model.CommunityLifecycle, community_id: site.id)

           {:ok, _} =
             community_lifecycle |> Ecto.Changeset.change(state: :suspended) |> Repo.update()

           refute Repo.exists?(public_scope.())
           refute Repo.exists?(comment_scope.(doc_comments))

           assert {:error, %CMS.Gate.Decision{allowed: false}} =
                    CMS.Gate.access_check(nil, :read, gate_identity)

           Repo.rollback(:community_restriction_rollback)
         end)

endpoint = Repo.get_by!(CMS.Model.Mentions.Endpoint, type: :doc, article_id: article.id)

assert {:ok, %{published_revision_identity: revision_identity, branch_id: nil}} =
         CMS.ArtimentMentions.Query.selected_source(endpoint)

assert revision_identity == "article-snapshot:#{snapshot.id}"

assert Repo.get_by!(CMS.Model.Mentions.Edge, source_endpoint_id: endpoint.id, target_type: :url).normalized_url ==
         "https://example.com/docs"

assert %{state: :published, version: 2, first_published_at: %DateTime{}} =
         Repo.get_by!(DocsLifecycle, article_id: article.id)

assert is_integer(
         Repo.get_by!(ArticleBinding, article_id: article.id, community_id: site.id).inner_id
       )

binding = Repo.get_by!(ArticleBinding, article_id: article.id, community_id: site.id)

assert {:ok, %{article_id: id, snapshot_id: selected_snapshot_id, title: "Doc"}} =
         CMS.FrontDesk.Article.read_stable(site, :doc, binding.inner_id, nil, [])

assert id == article.id and selected_snapshot_id == snapshot.id

path = %{community: site.slug, thread: :doc, inner_id: binding.inner_id}
assert {:ok, %{snapshot_id: selected_snapshot_id}} = CMS.FrontDesk.Article.read(path, nil, [])
assert selected_snapshot_id == snapshot.id
assert {:ok, [%{id: id, title: "Doc"}]} = CMS.Articles.Pagination.lite_paths([path])
assert id == article.id

assert {:ok, %{entries: [%{id: id, title: "Doc"}]}} =
         CMS.Articles.Pagination.page(
           :doc,
           %{community: site.slug},
           %GroupherServer.Pagi.Params.Offset{page: 1, size: 20, config_revision: 0},
           nil,
           config: Helper.ORM.Pagi.Config.default(),
           public_tree: true
         )

assert id == article.id

assert Repo.get_by!(CMS.Model.ArticleStats, article_id: article.id, thread: :doc)
assert Repo.get!(DocsRelease, release.id).sealed

assert Repo.get_by!(DocsReleaseArticle, release_id: release.id, article_id: article.id).snapshot_id ==
         snapshot.id

assert Repo.get(ArticleWorkingCopy, member.working_copy_id) == nil

assert Repo.aggregate(
         from(n in DocsTreeNode, where: n.community_id == ^site.id and n.stage == :public),
         :count
       ) == 3

assert Repo.aggregate(
         from(c in CMS.Model.DocsQueueTreeChange, where: c.queue_id == ^queue.id),
         :count
       ) == 0

assert {:error, :affected_parent_rollback} =
         Repo.transaction(fn ->
           renamed =
             Enum.map(target, fn item ->
               if item.node_id == "group", do: %{item | title: "Renamed group"}, else: item
             end)

           assert {:ok, _} = Queue.reconcile_tree(site, queue, 3, target, renamed, actor)

           changes =
             Repo.all(
               from(c in CMS.Model.DocsQueueTreeChange,
                 where: c.queue_id == ^queue.id,
                 order_by: c.node_id
               )
             )

           assert {:ok, %{article_ids: [affected_id], deleted: []}} =
                    CMS.DocTree.Publish.Affected.lock(site, [], changes)

           assert affected_id == article.id
           Repo.rollback(:affected_parent_rollback)
         end)

assert {:error, %Postgrex.Error{postgres: %{code: :check_violation}}} =
         Repo.query("UPDATE cms.doc_publish_releases SET plan_format_version=2 WHERE id=$1", [
           release.id
         ])

changed_target =
  Enum.map(target, fn node ->
    if node.node_id == "page", do: %{node | badge: "new"}, else: node
  end)

assert {:ok, %{queue: %{queue_revision: 4}}} =
         Repo.transact(fn ->
           Queue.reconcile_tree(site, queue, 3, target, changed_target, actor)
         end)

page = Enum.find(changed_target, &(&1.node_id == "page"))
changes = [%{node_id: "page", change_kind: :upsert, target: Map.delete(page, :node_id)}]
assert {:ok, tree_plan} = Plan.build(release.id, target, changes, [], [article.id])

assert {:ok, second_release} =
         Repo.transact(fn ->
           assert {:ok, _} = PublicTree.apply(site, queue, 4, tree_plan)

           assert {:ok, %{release: next}} =
                    Release.record(
                      site,
                      queue,
                      4,
                      tree_plan,
                      [],
                      [],
                      nil,
                      actor,
                      DateTime.utc_now(:second)
                    )

           assert {:ok,
                   %{
                     queue: %{queue_revision: 5, public_presentation_revision: 2},
                     tree_changes_consumed: 1
                   }} =
                    Queue.consume_release(site, queue, 4, next.id, [])

           {:ok, next}
         end)

assert second_release.base_release_id == release.id
assert {:ok, %{queue_revision: 5, public_release_id: second_id}} = Queue.read(site)
assert second_id == second_release.id

assert Repo.aggregate(
         from(c in CMS.Model.DocsQueueTreeChange, where: c.queue_id == ^queue.id),
         :count
       ) == 0

assert Repo.get!(ArticlePublic, article.id).snapshot_id == snapshot.id

assert Repo.get_by!(DocsTreeNode, community_id: site.id, stage: :public, node_id: "page").badge ==
         "new"

link_a = %{node.("a", :link, "group", nil) | index: 1, href: "/a", title: "A"}
link_b = %{node.("b", :link, "group", nil) | index: 2, href: "/b", title: "B"}
with_links = changed_target ++ [link_a, link_b]

assert {:ok, _} =
         Repo.transact(fn ->
           Queue.reconcile_tree(site, queue, 5, changed_target, with_links, actor)
         end)

link_changes =
  Enum.map(
    [link_a, link_b],
    &%{node_id: &1.node_id, change_kind: :upsert, target: Map.delete(&1, :node_id)}
  )

assert {:ok, links_plan} =
         Plan.build(second_release.id, changed_target, link_changes, [], [article.id])

assert {:ok, third_release} =
         Repo.transact(fn ->
           assert {:ok, _} = PublicTree.apply(site, queue, 6, links_plan)

           assert {:ok, %{release: next}} =
                    Release.record(
                      site,
                      queue,
                      6,
                      links_plan,
                      [],
                      [],
                      nil,
                      actor,
                      DateTime.utc_now(:second)
                    )

           assert {:ok, _} = Queue.consume_release(site, queue, 6, next.id, [])
           {:ok, next}
         end)

old_a = Repo.get_by!(DocsTreeNode, community_id: site.id, stage: :public, node_id: "a")
old_b = Repo.get_by!(DocsTreeNode, community_id: site.id, stage: :public, node_id: "b")
swapped_a = %{link_a | index: 2, title: "B"}
swapped_b = %{link_b | index: 1, title: "A"}
swapped = changed_target ++ [swapped_a, swapped_b]

assert {:ok, _} =
         Repo.transact(fn -> Queue.reconcile_tree(site, queue, 7, with_links, swapped, actor) end)

swap_changes =
  Enum.map(
    [swapped_a, swapped_b],
    &%{node_id: &1.node_id, change_kind: :upsert, target: Map.delete(&1, :node_id)}
  )

assert {:ok, swap_plan} = Plan.build(third_release.id, with_links, swap_changes, [], [article.id])

assert {:ok, _} =
         Repo.transact(fn ->
           assert {:ok, _} = PublicTree.apply(site, queue, 8, swap_plan)

           assert {:ok, %{release: next}} =
                    Release.record(
                      site,
                      queue,
                      8,
                      swap_plan,
                      [],
                      [],
                      nil,
                      actor,
                      DateTime.utc_now(:second)
                    )

           Queue.consume_release(site, queue, 8, next.id, [])
         end)

assert %{id: old_a_id, index: 2, title: "B"} =
         Repo.get_by!(DocsTreeNode, community_id: site.id, stage: :public, node_id: "a")

assert %{id: old_b_id, index: 1, title: "A"} =
         Repo.get_by!(DocsTreeNode, community_id: site.id, stage: :public, node_id: "b")

assert old_a_id == old_a.id and old_b_id == old_b.id

assert {:ok, second_article} =
         Repo.transact(fn ->
           second =
             %Article{}
             |> Article.changeset(%{thread: :doc, author_id: author.id})
             |> Repo.insert!()

           %ArticleBinding{}
           |> ArticleBinding.changeset(%{article_id: second.id, community_id: site.id})
           |> Repo.insert!()

           {:ok, default} =
             Store.create_loaded(
               second,
               %{scope_kind: :default, scope_id: second.id, title: "Second", body_bag: body},
               actor,
               site.id
             )

           {:ok, snapshot} =
             Snapshotter.freeze_in_transaction(default.id, 1, actor, Ecto.UUID.generate())

           {:ok, _} = CMS.Articles.Public.select_snapshot(second, snapshot, actor)
           {:ok, second}
         end)

{:ok, %{public_release_id: swap_release_id}} = Queue.read(site)
page2 = %{node.("page2", :page, "group", second_article.id) | index: 3}
two_pages = swapped ++ [page2]

assert {:ok, _} =
         Repo.transact(fn -> Queue.reconcile_tree(site, queue, 9, swapped, two_pages, actor) end)

assert {:ok, page_plan} =
         Plan.build(
           swap_release_id,
           swapped,
           [%{node_id: "page2", change_kind: :upsert, target: Map.delete(page2, :node_id)}],
           [],
           [article.id, second_article.id]
         )

assert {:ok, page_release} =
         Repo.transact(fn ->
           assert {:ok, _} = PublicTree.apply(site, queue, 10, page_plan)

           assert {:ok, %{release: next}} =
                    Release.record(
                      site,
                      queue,
                      10,
                      page_plan,
                      [],
                      [],
                      nil,
                      actor,
                      DateTime.utc_now(:second)
                    )

           assert {:ok, _} = Queue.consume_release(site, queue, 10, next.id, [])
           {:ok, next}
         end)

old_page = Repo.get_by!(DocsTreeNode, community_id: site.id, stage: :public, node_id: "page")
old_page2 = Repo.get_by!(DocsTreeNode, community_id: site.id, stage: :public, node_id: "page2")

pages_swapped =
  Enum.map(two_pages, fn item ->
    case item.node_id do
      "page" -> %{item | doc_id: second_article.id}
      "page2" -> %{item | doc_id: article.id}
      _ -> item
    end
  end)

assert {:ok, _} =
         Repo.transact(fn ->
           Queue.reconcile_tree(site, queue, 11, two_pages, pages_swapped, actor)
         end)

swapped_pages = pages_swapped |> Enum.filter(&(&1.node_id in ["page", "page2"]))

page_changes =
  Enum.map(
    swapped_pages,
    &%{node_id: &1.node_id, change_kind: :upsert, target: Map.delete(&1, :node_id)}
  )

assert {:ok, final_plan} =
         Plan.build(page_release.id, two_pages, page_changes, [], [article.id, second_article.id])

assert {:ok, _} =
         Repo.transact(fn ->
           assert {:ok, _} = PublicTree.apply(site, queue, 12, final_plan)

           assert {:ok, %{release: next}} =
                    Release.record(
                      site,
                      queue,
                      12,
                      final_plan,
                      [],
                      [],
                      nil,
                      actor,
                      DateTime.utc_now(:second)
                    )

           Queue.consume_release(site, queue, 12, next.id, [])
         end)

assert %{id: page_id, doc_id: second_id} =
         Repo.get_by!(DocsTreeNode, community_id: site.id, stage: :public, node_id: "page")

assert %{id: page2_id, doc_id: first_id} =
         Repo.get_by!(DocsTreeNode, community_id: site.id, stage: :public, node_id: "page2")

assert page_id == old_page.id and page2_id == old_page2.id
assert second_id == second_article.id and first_id == article.id

without_page = Enum.reject(pages_swapped, &(&1.node_id == "page2"))

assert {:ok, _} =
         Repo.transact(fn ->
           Queue.reconcile_tree(site, queue, 13, pages_swapped, without_page, actor)
         end)

assert {:error, %CMS.Gate.Decision{allowed: false}} =
         Repo.transact(fn ->
           QueueRelease.run(site, queue, 14, unauthorized_publisher, Ecto.UUID.generate())
         end)

assert Repo.get!(ArticlePublic, article.id)

assert {:error, :deleted_page_approval_rollback} =
         Repo.transaction(fn ->
           assert {:ok, _} = Queue.set_policy(site, queue, 0, true, false)
           {:ok, approver} = db_insert(:user)
           lifecycle = Repo.get_by!(DocsLifecycle, article_id: article.id)
           {:ok, _} = lifecycle |> DocsLifecycle.changeset(%{state: :deleted}) |> Repo.update()

           assert {:error, :doc_lifecycle_not_public} =
                    Approval.approve(site, queue, 14, approver, Ecto.UUID.generate())

           Repo.rollback(:deleted_page_approval_rollback)
         end)

assert {:error, :page_approval_rollback} =
         Repo.transaction(fn ->
           assert {:ok, _} = Queue.set_policy(site, queue, 0, true, false)
           {:ok, approver} = db_insert(:user)

           assert {:ok, %{approval: %{sealed: true}}} =
                    Approval.approve(site, queue, 14, approver, Ecto.UUID.generate())

           Repo.rollback(:page_approval_rollback)
         end)

assert {:error, :deletion_rollback} =
         Repo.transaction(fn ->
           assert {:ok, _} = QueueRelease.run(site, queue, 14, actor, Ecto.UUID.generate())

           assert %{state: :deleted, version: 3} =
                    Repo.get_by!(DocsLifecycle, article_id: article.id)

           Repo.rollback(:deletion_rollback)
         end)

assert %{state: :published, version: 2, deleted_at: nil} =
         Repo.get_by!(DocsLifecycle, article_id: article.id)

assert Repo.get!(ArticlePublic, article.id)

assert {:ok,
        %{
          release: deletion_release,
          deleted_article_ids: [deleted_id],
          queue: %{queue_revision: 15}
        }} =
         Repo.transact(fn -> QueueRelease.run(site, queue, 14, actor, Ecto.UUID.generate()) end)

assert deleted_id == article.id
assert Repo.get(ArticlePublic, article.id) == nil
assert {:error, _} = CMS.FrontDesk.Article.read_stable(site, :doc, binding.inner_id, nil, [])
assert {:ok, []} = CMS.Articles.Pagination.lite_paths([path])
assert {:ok, %{tabs: tabs_after_deletion}} = CMS.DocTree.read_public(site)

remaining_docs =
  for tab <- tabs_after_deletion, group <- tab.groups, page <- group.pages, do: page.doc_id

refute article.id in remaining_docs
refute Repo.exists?(public_scope.())

assert {:error, %CMS.Gate.Decision{allowed: false}} =
         CMS.Gate.access_check(nil, :read, gate_identity)

refute Repo.exists?(comment_scope.(doc_comments))
refute Repo.exists?(comment_scope.(all_comments))
assert {:error, %CMS.Gate.Decision{allowed: false}} = CMS.Gate.access_check(actor, :edit, comment)

assert {:error, :mention_current_source_missing} =
         CMS.ArtimentMentions.Query.selected_source(endpoint)

assert %{state: :deleted, version: 3, deleted_at: %DateTime{}} =
         Repo.get_by!(DocsLifecycle, article_id: article.id)

assert Repo.get!(ArticlePublic, second_article.id)

assert %{action: :delete, snapshot_id: nil} =
         Repo.get_by!(DocsReleaseArticle, release_id: deletion_release.id, article_id: article.id)

refute Repo.get_by(DocsTreeNode, community_id: site.id, stage: :public, node_id: "page2")

IO.puts("Docs Release recording passed")

# This deliberate SQL error owns its transaction so it cannot poison publication checks.
migration = GroupherServer.Repo.Migrations.RemoveDocsPlanDigests

unless Code.ensure_loaded?(migration) do
  Code.require_file("priv/repo/migrations/20261112150000_remove_docs_plan_digests.exs")
end

assert_raise Postgrex.Error, ~r/R4 requires empty/, fn ->
  Repo.transaction(fn ->
    Ecto.Migration.Runner.run(
      Repo,
      Repo.config(),
      20_261_112_150_000,
      migration,
      :forward,
      :up,
      :up,
      log: false
    )
  end)
end

IO.puts("R4 nonempty migration refusal passed")
