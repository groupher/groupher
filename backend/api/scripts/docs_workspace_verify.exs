# Run only against an explicitly named, fully migrated disposable Docs test database.
import ExUnit.Assertions
import Ecto.Query
import GroupherServer.Support.Factory

alias GroupherServer.{CMS, Repo}
alias CMS.DocTree.Publish.Queue
alias CMS.Model.{Article, ArticleWorkingCopy, Author, DocsLifecycle, DocsTreeNode}

[[database]] = Repo.query!("SELECT current_database()").rows
expected = System.get_env("DOCS_B0_DISPOSABLE_DATABASE")

unless Mix.env() == :test and is_binary(expected) and expected == database and
         String.starts_with?(database, "groupher_docs_b0_") do
  raise "Docs Release exercise requires an explicitly named disposable test database"
end

{:ok, actor} = db_insert(:user)
{:ok, mention_recipient} = db_insert(:user)
site_name = "release-" <> Ecto.UUID.generate()
{:ok, site} = db_insert(:community, title: site_name, aka: site_name, slug: site_name)
Repo.insert!(%Author{user_id: actor.id})

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
        },
        %{
          "type" => "mention",
          "key" => "user:#{mention_recipient.login}",
          "value" => mention_recipient.login,
          "children" => [%{"text" => ""}]
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

alias CMS.DocTree.Commands.{CreateWorkspaceNode, Enqueue}
assert {:ok, %{id: nil, tree_lock_version: 0, queue_revision: 0}} = Queue.read(site)
tab_command = Ecto.UUID.generate()

assert {:ok, %{node_id: tab, tree_revision: 1} = result} =
         CreateWorkspaceNode.execute(site, 0, %{type: :tab, title: "Tab"}, actor, tab_command)

assert {:ok, ^result} =
         CreateWorkspaceNode.execute(site, 0, %{type: :tab, title: "Tab"}, actor, tab_command)

assert {:ok, %{tree_lock_version: 1, queue_revision: 0, public_presentation_revision: 0}} =
         Queue.read(site)

assert {:error, _} =
         CreateWorkspaceNode.execute(
           site,
           0,
           %{type: :tab, title: "Stale"},
           actor,
           Ecto.UUID.generate()
         )

assert {:ok, %{node_id: group, tree_revision: 2}} =
         CreateWorkspaceNode.execute(
           site,
           1,
           %{type: :group, title: "Group", parent_node_id: tab},
           actor,
           Ecto.UUID.generate()
         )

assert {:error, _} =
         CreateWorkspaceNode.execute(
           site,
           2,
           %{type: :page, title: "Invalid", parent_node_id: "missing"},
           actor,
           Ecto.UUID.generate()
         )

assert {:ok, %{tree_lock_version: 2}} = Queue.read(site)

mutation = """
mutation CreateNode($community: String!, $revision: Int!, $commandId: ID!, $parent: ID!, $input: DocsWorkspaceNodeInput!) {
 createDocsWorkspaceNode(community: $community, treeRevision: $revision, commandId: $commandId, parentNodeId: $parent, input: $input) { nodeId articleId workingCopyId treeRevision }
}
"""

assert {:ok, %{data: %{"createDocsWorkspaceNode" => page}}} =
         Absinthe.run(mutation, GroupherServerWeb.Schema,
           variables: %{
             "community" => site.slug,
             "revision" => 2,
             "commandId" => Ecto.UUID.generate(),
             "parent" => group,
             "input" => %{"type" => "PAGE", "title" => "Page"}
           },
           context: %{cur_user: actor}
         )

assert page["treeRevision"] == 3
article = Repo.get!(Article, page["articleId"])
work = Repo.get!(ArticleWorkingCopy, page["workingCopyId"])
assert work.scope_kind == :default and work.scope_id == article.id
assert %{default_working_copy_id: id} = Repo.get_by!(DocsLifecycle, article_id: article.id)
assert id == work.id
assert {:ok, %{tree_lock_version: 3, queue_revision: 0}} = Queue.read(site)

{:ok, _} =
  CMS.Passport.stamp_passport(
    %{"global" => %{}, site.slug => %{"cms" => %{"doc.queue.write" => true}}},
    actor
  )

assert {:error, :invalid_body} =
         Enqueue.execute(
           site,
           0,
           [%{article_id: article.id, default_revision: 1}],
           actor,
           Ecto.UUID.generate()
         )

assert {:ok, %{revision: 2}} =
         CMS.Articles.Commands.SaveWorkingCopy.execute(
           article,
           site,
           work.id,
           %{body_bag: body},
           1,
           actor,
           Ecto.UUID.generate()
         )

enqueue_mutation = """
mutation Enqueue($community: String!, $revision: Int!, $commandId: ID!, $entries: [DocsQueueEntryInput!]!) {
  enqueueDocs(community: $community, queueRevision: $revision, commandId: $commandId, entries: $entries) { queueRevision }
}
"""

assert {:ok, %{data: %{"enqueueDocs" => %{"queueRevision" => 1}}}} =
         Absinthe.run(enqueue_mutation, GroupherServerWeb.Schema,
           variables: %{
             "community" => site.slug,
             "revision" => 0,
             "commandId" => Ecto.UUID.generate(),
             "entries" => [%{"articleId" => article.id, "defaultRevision" => 2}]
           },
           context: %{cur_user: actor}
         )

assert {:ok, %{tree_lock_version: 3, queue_revision: 1}} = Queue.read(site)

member = Repo.get_by!(CMS.Model.DocsQueueArticle, article_id: article.id)
queue_work = Repo.get!(ArticleWorkingCopy, member.working_copy_id)
merge_command = Ecto.UUID.generate()

assert {:error, _} =
         CMS.DocTree.Commands.MergeQueue.execute(
           site,
           1,
           article.id,
           2,
           queue_work.revision,
           %{},
           actor,
           Ecto.UUID.generate()
         )

assert {:ok, _} =
         CMS.Passport.stamp_passport(
           %{"global" => %{}, site.slug => %{"cms" => %{"doc.queue.preview" => true}}},
           actor
         )

assert {:error, _} = CMS.Gate.Access.Check.doc_snapshot(actor, :edit, site, article)
{:ok, snapshot_outsider} = db_insert(:user)

assert {:ok, :checked} =
         Repo.transaction(fn ->
           Repo.query!("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY")

           assert {:ok, _} =
                    CMS.Gate.Access.Check.community_snapshot(actor, :docs_queue_preview, site)

           assert {:ok, _} = CMS.Gate.Access.Check.doc_snapshot(actor, :edit, site, article)

           assert {:error, _} =
                    CMS.Gate.Access.Check.community_snapshot(
                      snapshot_outsider,
                      :docs_queue_preview,
                      site
                    )

           assert {:error, _} =
                    CMS.Gate.Access.Check.doc_snapshot(snapshot_outsider, :edit, site, article)

           :checked
         end)

assert {:ok, locked_plan} =
         Repo.transact(fn ->
           with {:ok, queue} <- Queue.lock_or_create(site),
                {:ok, locked} <-
                  CMS.DocTree.Publish.Queue.Dequeue.load_locked(site, queue, [article.id]),
                changes <-
                  Repo.all(
                    from(c in CMS.Model.DocsQueueTreeChange, where: c.queue_id == ^queue.id)
                  ),
                {:ok, plan} <-
                  CMS.DocTree.Publish.Approval.build_plan(site, queue, locked.rows, changes) do
             {:ok, plan.payload}
           end
         end)

assert {:ok, ^locked_plan} =
         Repo.transaction(fn ->
           Repo.query!("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY")

           assert {:ok, _} =
                    CMS.Gate.Access.Check.community_snapshot(actor, :docs_queue_preview, site)

           assert {:ok, _} = CMS.Gate.Access.Check.doc_snapshot(actor, :edit, site, article)
           assert {:ok, queue} = Queue.read(site)

           rows =
             Repo.all(
               from(m in CMS.Model.DocsQueueArticle,
                 join: w in ArticleWorkingCopy,
                 on: w.id == m.working_copy_id,
                 join: a in Article,
                 on: a.id == m.article_id,
                 where: m.queue_id == ^queue.id,
                 select: %{article: a, copy: w}
               )
             )

           changes =
             Repo.all(from(c in CMS.Model.DocsQueueTreeChange, where: c.queue_id == ^queue.id))

           assert {:ok, plan} =
                    CMS.DocTree.Publish.Approval.build_plan(site, queue, rows, changes, :snapshot)

           plan.payload
         end)

assert {:ok, %{queue_revision: 1, working_copy_revision: work_revision} = merge_result} =
         CMS.DocTree.Commands.MergeQueue.execute(
           site,
           1,
           article.id,
           2,
           queue_work.revision,
           %{},
           actor,
           merge_command
         )

assert work_revision == queue_work.revision

assert {:ok, ^merge_result} =
         CMS.DocTree.Commands.MergeQueue.execute(
           site,
           1,
           article.id,
           2,
           queue_work.revision,
           %{},
           actor,
           merge_command
         )

assert {:error, _} =
         CMS.DocTree.Commands.MergeQueue.execute(
           site,
           1,
           article.id,
           1,
           queue_work.revision,
           %{},
           actor,
           Ecto.UUID.generate()
         )

merge_mutation = """
mutation MergeDocs($community: String!, $article: ID!, $queue: Int!, $default: Int!, $work: Int!, $commandId: ID!, $choices: [DocsMergeChoiceInput!]! = []) {
  mergeDocsQueueCopy(community: $community, articleId: $article, queueRevision: $queue, defaultRevision: $default, workingCopyRevision: $work, commandId: $commandId, choices: $choices) {
    queueRevision workingCopyRevision conflict { fields queueRevision defaultRevision workingCopyRevision }
  }
}
"""

merge_vars = %{
  "community" => site.slug,
  "article" => article.id,
  "queue" => 1,
  "default" => 2,
  "work" => queue_work.revision,
  "commandId" => Ecto.UUID.generate()
}

assert {:ok, %{data: %{"mergeDocsQueueCopy" => %{"queueRevision" => 1, "conflict" => nil}}}} =
         Absinthe.run(merge_mutation, GroupherServerWeb.Schema,
           variables: merge_vars,
           context: %{cur_user: actor}
         )

assert {:ok, %{errors: [%{extensions: %{code: 4569}} | _]}} =
         Absinthe.run(merge_mutation, GroupherServerWeb.Schema,
           variables:
             Map.merge(merge_vars, %{"default" => 1, "commandId" => Ecto.UUID.generate()}),
           context: %{cur_user: actor}
         )

save_queue_mutation = """
mutation SaveQueue($community: String!, $article: ID!, $queue: Int!, $work: Int!, $title: String!, $commandId: ID!) {
  saveDocsQueueCopy(community: $community, articleId: $article, queueRevision: $queue, workingCopyRevision: $work, title: $title, commandId: $commandId) {
    queueRevision workingCopyRevision
  }
}
"""

save_body_mutation = """
mutation SaveQueueBody($community: String!, $article: ID!, $queue: Int!, $work: Int!, $body: ArtimentBodyBagInput!, $commandId: ID!) {
  saveDocsQueueCopy(community: $community, articleId: $article, queueRevision: $queue, workingCopyRevision: $work, bodyBag: $body, commandId: $commandId) { queueRevision workingCopyRevision }
}
"""

body_vars = %{
  "community" => site.slug,
  "article" => article.id,
  "queue" => 1,
  "work" => queue_work.revision,
  "commandId" => Ecto.UUID.generate(),
  "body" => %{
    "json" => body.json,
    "markdown" => body.markdown,
    "html" => body.html,
    "toc" => [],
    "plainText" => body.plain_text,
    "digest" => body.digest,
    "bodyHash" => body.body_hash,
    "schemaVersion" => body.schema_version,
    "thumbnail" => Jason.encode!(body.thumbnail)
  }
}

assert {:ok, %{errors: [_ | _]}} =
         Absinthe.run(save_body_mutation, GroupherServerWeb.Schema,
           variables: body_vars,
           context: %{cur_user: actor}
         )

assert {:error, :queue_body_rollback} =
         Repo.transaction(fn ->
           assert {:ok, %{data: %{"saveDocsQueueCopy" => %{"queueRevision" => 2}}}} =
                    Absinthe.run(save_body_mutation, GroupherServerWeb.Schema,
                      variables: body_vars,
                      context: %{
                        cur_user: actor,
                        service_actor: %{subject: "service:test-suite", scopes: MapSet.new(["*"])}
                      }
                    )

           Repo.rollback(:queue_body_rollback)
         end)

for resolve? <- [false, true] do
  assert {:error, :merge_exercise_rollback} =
           Repo.transaction(fn ->
             assert {:ok, %{revision: 3}} =
                      CMS.Articles.Commands.SaveWorkingCopy.execute(
                        article,
                        site,
                        work.id,
                        %{title: "Default changed"},
                        2,
                        actor,
                        Ecto.UUID.generate()
                      )

             save_vars = %{
               "community" => site.slug,
               "article" => article.id,
               "queue" => 1,
               "work" => queue_work.revision,
               "title" => "Queue changed",
               "commandId" => Ecto.UUID.generate()
             }

             assert {:ok,
                     %{
                       data: %{
                         "saveDocsQueueCopy" => %{
                           "queueRevision" => 2,
                           "workingCopyRevision" => saved_revision
                         }
                       }
                     }} =
                      Absinthe.run(save_queue_mutation, GroupherServerWeb.Schema,
                        variables: save_vars,
                        context: %{cur_user: actor}
                      )

             assert {:ok, %{data: %{"saveDocsQueueCopy" => %{"queueRevision" => 2}}}} =
                      Absinthe.run(save_queue_mutation, GroupherServerWeb.Schema,
                        variables: save_vars,
                        context: %{cur_user: actor}
                      )

             changed_work = Repo.get!(ArticleWorkingCopy, queue_work.id)
             assert changed_work.revision == saved_revision
             assert Repo.get!(ArticleWorkingCopy, work.id).title == "Default changed"

             conflict_vars =
               Map.merge(merge_vars, %{
                 "queue" => 2,
                 "default" => 3,
                 "work" => changed_work.revision,
                 "commandId" => Ecto.UUID.generate()
               })

             if resolve? do
               assert {:ok,
                       %{
                         data: %{
                           "mergeDocsQueueCopy" => %{"queueRevision" => 3, "conflict" => nil}
                         }
                       }} =
                        Absinthe.run(merge_mutation, GroupherServerWeb.Schema,
                          variables:
                            Map.merge(conflict_vars, %{
                              "choices" => [%{"field" => "TITLE", "side" => "SOURCE"}],
                              "commandId" => Ecto.UUID.generate()
                            }),
                          context: %{cur_user: actor}
                        )

               assert %{title: "Default changed"} = Repo.get!(ArticleWorkingCopy, changed_work.id)
             else
               assert {:ok,
                       %{
                         data: %{
                           "mergeDocsQueueCopy" => %{
                             "conflict" => %{
                               "fields" => ["TITLE"],
                               "queueRevision" => 2,
                               "defaultRevision" => 3
                             }
                           }
                         }
                       }} =
                        Absinthe.run(merge_mutation, GroupherServerWeb.Schema,
                          variables: conflict_vars,
                          context: %{cur_user: actor}
                        )
             end

             Repo.rollback(:merge_exercise_rollback)
           end)
end

assert {:ok, %{node_id: nested, tree_revision: 4}} =
         CreateWorkspaceNode.execute(
           site,
           3,
           %{type: :group, title: "Nested", parent_node_id: group},
           actor,
           Ecto.UUID.generate()
         )

assert %{index: 0} =
         Repo.get_by!(DocsTreeNode, community_id: site.id, stage: :draft, node_id: nested)

assert %{index: 1} =
         Repo.get_by!(DocsTreeNode, community_id: site.id, stage: :draft, node_id: page["nodeId"])

query = """
query Workspace($community: String!) {
  docsWorkspaceTree(community: $community) { treeRevision nodes { nodeId type parentNodeId docId workingCopyId workingCopyRevision published } }
}
"""

assert {:ok, %{data: %{"docsWorkspaceTree" => %{"treeRevision" => 4, "nodes" => nodes}}}} =
         Absinthe.run(query, GroupherServerWeb.Schema,
           variables: %{"community" => site.slug},
           context: %{cur_user: actor}
         )

assert Enum.any?(
         nodes,
         &(&1["docId"] == article.id and &1["workingCopyId"] == work.id and
             &1["workingCopyRevision"] == 2 and &1["published"] == false)
       )

binding = Repo.get_by!(CMS.Model.ArticleBinding, article_id: article.id, community_id: site.id)
assert {:error, _} = CMS.FrontDesk.Article.read_stable(site, :doc, binding.inner_id, nil, [])

assert {:ok, _} =
         CMS.Passport.stamp_passport(
           %{"global" => %{}, site.slug => %{"cms" => %{"doc.queue.publish" => true}}},
           actor
         )

release_mutation = """
mutation Release($community: String!, $revision: Int!, $commandId: ID!) {
  releaseDocsQueue(community: $community, queueRevision: $revision, commandId: $commandId) {
    releaseId queueRevision
  }
}
"""

assert {:ok, %{data: %{"releaseDocsQueue" => %{"queueRevision" => 2}}}} =
         Absinthe.run(release_mutation, GroupherServerWeb.Schema,
           variables: %{
             "community" => site.slug,
             "revision" => 1,
             "commandId" => Ecto.UUID.generate()
           },
           context: %{cur_user: actor}
         )

assert {:ok, %{tabs: [%{groups: [%{pages: [%{doc_id: doc_id}]}]}]}} =
         CMS.DocTree.read_public(site)

assert doc_id == article.id
binding = Repo.get_by!(CMS.Model.ArticleBinding, article_id: article.id, community_id: site.id)

assert {:ok, %{article_id: id}} =
         CMS.FrontDesk.Article.read_stable(site, :doc, binding.inner_id, nil, [])

assert id == article.id

%CMS.Model.PressConfig{}
|> CMS.Model.PressConfig.changeset(%{
  community_id: site.id,
  feed_enabled: true,
  feed_threads: ["doc"]
})
|> Repo.insert!()

assert {:ok, %{article_id: public_doc_id, content_version: public_version}} =
         CMS.Press.Query.article(%{
           community: site.slug,
           thread: :doc,
           inner_id: binding.inner_id
         })

assert public_doc_id == article.id
assert public_version == Repo.get!(CMS.Model.ArticlePublic, article.id).snapshot_id
assert {:ok, %{items: press_items}} = CMS.Press.Query.thread_rss_feed(site, :doc, [])
assert Enum.any?(press_items, &(&1.item_id == article.id))

cache_event = Repo.get_by!(CMS.Outbox.Event, event: "article.published", resource_id: article.id)
assert Repo.get_by!(CMS.Outbox.Event, event: "doc_tree.changed", resource_id: to_string(site.id))
cache_job = %Oban.Job{args: %{"event_id" => cache_event.id}, attempt: 1, max_attempts: 5}
assert {:ok, :pass} = GroupherServer.Jobs.CMSOutboxArticle.perform(cache_job)
assert {:ok, :pass} = GroupherServer.Jobs.CMSOutboxArticle.perform(cache_job)

for name <- ["article.search_sync", "article.cdn_purge", "press.cache_invalidation"] do
  assert Repo.aggregate(
           from(e in CMS.Outbox.Event,
             where: e.command_id == ^cache_event.id and e.event == ^name
           ),
           :count
         ) == 1
end

endpoint = Repo.get_by!(CMS.Model.Mentions.Endpoint, type: :doc, article_id: article.id)
event = Repo.get_by!(CMS.Outbox.Event, event: "mention.notify", resource_id: endpoint.id)
job = %Oban.Job{args: %{"event_id" => event.id}, attempt: 1, max_attempts: 5}
assert {:ok, :pass} = GroupherServer.Jobs.CMSMentionNotifier.perform(job)
assert {:ok, :pass} = GroupherServer.Jobs.CMSMentionNotifier.perform(job)

mention =
  Repo.get_by!(GroupherServer.Messaging.Model.Mention,
    article_id: article.id,
    to_user_id: mention_recipient.id
  )

assert mention.target_key == "doc:#{article.id}"

assert mention.content_token ==
         "article-snapshot:#{Repo.get!(CMS.Model.ArticlePublic, article.id).snapshot_id}"

assert Repo.aggregate(
         from(m in GroupherServer.Messaging.Model.Mention, where: m.article_id == ^article.id),
         :count
       ) == 1

# A report targets the current public Snapshot and its hold is read by the same
# Gate used by public details and navigation. No legacy branch is involved.
snapshot_id = Repo.get!(CMS.Model.ArticlePublic, article.id).snapshot_id
version = CMS.Review.SnapshotVersion.from_id(snapshot_id)

report = %{
  owner: :cms,
  target_type: :doc,
  target_id: article.id,
  community_id: nil,
  observed_version: version
}

request = Repo.get_by!(CMS.Model.ArtimentReview, target_type: :doc, article_id: article.id)
assert request.state == :queued
assert {:ok, _} = Repo.transact(fn -> CMS.Review.Requests.claim_in_transaction(request.id) end)

assert {:ok, %{state: :completed}} =
         Repo.transact(fn ->
           CMS.Review.Results.apply_in_transaction(request.id, %{"status" => "clear"})
         end)

{:ok, reporter} = db_insert(:user)

report_mutation = """
mutation ReportDoc($input: AlertReportInput!, $commandId: ID!) {
  submitReport(input: $input, commandId: $commandId) { id reportType }
}
"""

assert {:ok, %{data: %{"submitReport" => %{"reportType" => "SPAM"}}}} =
         Absinthe.run(report_mutation, GroupherServerWeb.Schema,
           variables: %{
             "input" => %{
               "target" => %{
                 "type" => "DOC",
                 "observedVersion" => version,
                 "article" => %{
                   "community" => site.slug,
                   "thread" => "DOC",
                   "innerId" => Integer.to_string(binding.inner_id)
                 }
               },
               "reportType" => "SPAM",
               "details" => "Review this document"
             },
             "commandId" => Ecto.UUID.generate()
           },
           context: %{cur_user: reporter}
         )

assert {:ok, :pass} =
         Repo.transact(fn -> CMS.Review.Target.validate_report_target_in_transaction(report) end)

assert {:error, _} =
         Repo.transact(fn ->
           CMS.Review.Target.validate_report_target_in_transaction(%{
             report
             | observed_version: version + 1
           })
         end)

assert {:error, _} =
         Repo.transact(fn -> CMS.Review.load_for_update("doc:#{article.id}:1", "platform") end)

assert {:ok, block_id} =
         Repo.transact(fn ->
           with {:ok, context} <- CMS.Review.load_for_update("doc:#{article.id}", "platform"),
                {:ok, block} <-
                  CMS.ReviewBlocks.apply(context.lifecycle, %{
                    scope_key: context.scope_key,
                    type: :report_threshold_hold,
                    source: :domain,
                    source_ref: "docs-review-verification",
                    applied_at: DateTime.utc_now(:second)
                  }) do
             {:ok, block.id}
           end
         end)

assert {:error, _} = CMS.FrontDesk.Article.read_stable(site, :doc, binding.inner_id, nil, [])
assert {:ok, restricted_tree} = CMS.DocTree.read_public(site)
refute inspect(restricted_tree) =~ article.id

assert {:ok, :pass} =
         Repo.transact(fn ->
           with {:ok, context} <- CMS.Review.load_for_update("doc:#{article.id}", "platform") do
             CMS.ReviewBlocks.end_blocks(
               context.lifecycle,
               context.scope_key,
               [block_id],
               Ecto.UUID.generate(),
               "approved"
             )
           end
         end)

assert {:ok, %{article_id: _}} =
         CMS.FrontDesk.Article.read_stable(site, :doc, binding.inner_id, nil, [])

assert {:ok, %{data: %{"docsWorkspaceTree" => %{"nodes" => published_nodes}}}} =
         Absinthe.run(query, GroupherServerWeb.Schema,
           variables: %{"community" => site.slug},
           context: %{cur_user: actor}
         )

assert Enum.any?(published_nodes, &(&1["docId"] == article.id and &1["published"] == true))

update_mutation = """
mutation UpdateNode($community: String!, $revision: Int!, $nodeId: ID!, $commandId: ID!) {
  updateDocsWorkspaceNode(community: $community, treeRevision: $revision, nodeId: $nodeId, commandId: $commandId, patch: {title: "Updated navigation"}) { treeRevision }
}
"""

variables = %{
  "community" => site.slug,
  "revision" => 4,
  "nodeId" => page["nodeId"],
  "commandId" => Ecto.UUID.generate()
}

{:ok, outsider} = db_insert(:user)

assert {:ok, %{errors: [_ | _]}} =
         Absinthe.run(update_mutation, GroupherServerWeb.Schema,
           variables: variables,
           context: %{cur_user: outsider}
         )

assert {:ok, _} = CMS.Passport.erase_passport([site.slug, "cms", "doc.queue.write"], actor)

assert {:ok, %{errors: [_ | _]}} =
         Absinthe.run(update_mutation, GroupherServerWeb.Schema,
           variables: variables,
           context: %{cur_user: actor}
         )

assert {:ok, %{tree_lock_version: 4, queue_revision: 2}} = Queue.read(site)

assert {:ok, _} =
         CMS.Passport.stamp_passport(
           %{
             "global" => %{},
             site.slug => %{"cms" => %{"doc.queue.write" => true, "doc.queue.publish" => true}}
           },
           actor
         )

assert {:ok, %{data: %{"updateDocsWorkspaceNode" => %{"treeRevision" => 5}}}} =
         Absinthe.run(update_mutation, GroupherServerWeb.Schema,
           variables: variables,
           context: %{cur_user: actor}
         )

assert {:ok, %{tree_lock_version: 5, queue_revision: 3}} = Queue.read(site)

no_op = Map.merge(variables, %{"revision" => 5, "commandId" => Ecto.UUID.generate()})

assert {:ok, %{data: %{"updateDocsWorkspaceNode" => %{"treeRevision" => 5}}}} =
         Absinthe.run(update_mutation, GroupherServerWeb.Schema,
           variables: no_op,
           context: %{cur_user: actor}
         )

assert {:ok, %{tree_lock_version: 5, queue_revision: 3}} = Queue.read(site)

assert %{title: "Updated navigation", index: 1} =
         Repo.get_by!(DocsTreeNode, community_id: site.id, stage: :draft, node_id: page["nodeId"])

assert {:ok, %{tabs: [%{groups: [%{pages: [%{title: "Page"}]}]}]}} = CMS.DocTree.read_public(site)

assert {:ok, %{data: %{"releaseDocsQueue" => %{"queueRevision" => 4}}}} =
         Absinthe.run(release_mutation, GroupherServerWeb.Schema,
           variables: %{
             "community" => site.slug,
             "revision" => 3,
             "commandId" => Ecto.UUID.generate()
           },
           context: %{cur_user: actor}
         )

assert {:ok, %{tabs: [%{groups: [%{pages: [%{title: "Updated navigation"}]}]}]}} =
         CMS.DocTree.read_public(site)

move_mutation = """
mutation MoveNode($community: String!, $revision: Int!, $nodeId: ID!, $parent: ID!, $commandId: ID!) {
  moveDocsWorkspaceNode(community: $community, treeRevision: $revision, nodeId: $nodeId, parentNodeId: $parent, position: 0, commandId: $commandId) { treeRevision }
}
"""

move_variables = %{
  "community" => site.slug,
  "revision" => 5,
  "nodeId" => page["nodeId"],
  "parent" => nested,
  "commandId" => Ecto.UUID.generate()
}

assert {:ok, %{errors: [_ | _]}} =
         Absinthe.run(move_mutation, GroupherServerWeb.Schema,
           variables: move_variables,
           context: %{cur_user: outsider}
         )

assert {:ok, %{tree_lock_version: 5, queue_revision: 4}} = Queue.read(site)

assert {:ok, %{data: %{"moveDocsWorkspaceNode" => %{"treeRevision" => 6}}}} =
         Absinthe.run(move_mutation, GroupherServerWeb.Schema,
           variables: move_variables,
           context: %{cur_user: actor}
         )

assert {:ok, %{tree_lock_version: 6, queue_revision: 5}} = Queue.read(site)

move_no_op = Map.merge(move_variables, %{"revision" => 6, "commandId" => Ecto.UUID.generate()})

assert {:ok, %{data: %{"moveDocsWorkspaceNode" => %{"treeRevision" => 6}}}} =
         Absinthe.run(move_mutation, GroupherServerWeb.Schema,
           variables: move_no_op,
           context: %{cur_user: actor}
         )

assert {:ok, %{tree_lock_version: 6, queue_revision: 5}} = Queue.read(site)

assert {:ok, %{tabs: [%{groups: [%{pages: [%{title: "Updated navigation"}]}]}]}} =
         CMS.DocTree.read_public(site)

assert {:ok, %{data: %{"releaseDocsQueue" => %{"queueRevision" => 6}}}} =
         Absinthe.run(release_mutation, GroupherServerWeb.Schema,
           variables: %{
             "community" => site.slug,
             "revision" => 5,
             "commandId" => Ecto.UUID.generate()
           },
           context: %{cur_user: actor}
         )

assert {:ok,
        %{
          tabs: [
            %{groups: [%{pages: [%{title: "Nested", pages: [%{title: "Updated navigation"}]}]}]}
          ]
        }} = CMS.DocTree.read_public(site)

assert {:ok, %{article_id: pending_id, working_copy_id: pending_work, tree_revision: 7}} =
         CreateWorkspaceNode.execute(
           site,
           6,
           %{type: :page, title: "Pending", parent_node_id: group},
           actor,
           Ecto.UUID.generate()
         )

pending_article = Repo.get!(Article, pending_id)

assert {:ok, %{revision: 2}} =
         CMS.Articles.Commands.SaveWorkingCopy.execute(
           pending_article,
           site,
           pending_work,
           %{body_bag: body},
           1,
           actor,
           Ecto.UUID.generate()
         )

assert {:ok, _} =
         CMS.Passport.stamp_passport(
           %{
             "global" => %{},
             site.slug => %{
               "cms" => %{
                 "doc.queue.write" => true,
                 "doc.queue.preview" => true,
                 "doc.queue.publish" => true
               }
             }
           },
           actor
         )

assert {:ok, %{queue_revision: 7}} =
         Enqueue.execute(
           site,
           6,
           [%{article_id: pending_id, default_revision: 2}],
           actor,
           Ecto.UUID.generate()
         )

{:ok, queue} = Queue.read(site)
member = Repo.get_by!(CMS.Model.DocsQueueArticle, queue_id: queue.id, article_id: pending_id)
copy = Repo.get!(ArticleWorkingCopy, member.working_copy_id)

assert {:ok, %{queue: %{queue_revision: 8}}} =
         Repo.transact(fn ->
           Queue.save(site, queue, 7, pending_id, copy.revision, %{title: "Q only"}, actor)
         end)

preview_query = """
query PreviewDequeue($community: String!, $revision: Int!, $ids: [ID!]!) {
  docsDequeuePreview(community: $community, queueRevision: $revision, articleIds: $ids) {
    requiresConfirmation confirmation { formatVersion hash } documents { articleId exclusiveFields }
  }
}
"""

preview_variables = %{"community" => site.slug, "revision" => 8, "ids" => [pending_id]}

assert {:ok,
        %{
          data: %{
            "docsDequeuePreview" => %{
              "requiresConfirmation" => true,
              "confirmation" => proof,
              "documents" => [%{"articleId" => ^pending_id, "exclusiveFields" => ["title"]}]
            }
          }
        }} =
         Absinthe.run(preview_query, GroupherServerWeb.Schema,
           variables: preview_variables,
           context: %{cur_user: actor}
         )

dequeue_mutation = """
mutation Dequeue($community: String!, $revision: Int!, $ids: [ID!]!, $confirmation: DocsDiscardConfirmationInput, $commandId: ID!) {
  dequeueDocs(community: $community, queueRevision: $revision, articleIds: $ids, confirmation: $confirmation, commandId: $commandId) { queueRevision }
}
"""

dequeue_variables = Map.merge(preview_variables, %{"commandId" => Ecto.UUID.generate()})

assert {:ok, %{errors: [_ | _]}} =
         Absinthe.run(dequeue_mutation, GroupherServerWeb.Schema,
           variables: dequeue_variables,
           context: %{cur_user: actor}
         )

assert {:ok, %{queue_revision: 8}} = Queue.read(site)

assert {:ok, %{revision: 3}} =
         CMS.Articles.Commands.SaveWorkingCopy.execute(
           pending_article,
           site,
           pending_work,
           %{title: "D edit"},
           2,
           actor,
           Ecto.UUID.generate()
         )

assert {:ok, %{errors: [_ | _]}} =
         Absinthe.run(dequeue_mutation, GroupherServerWeb.Schema,
           variables: Map.put(dequeue_variables, "confirmation", proof),
           context: %{cur_user: actor}
         )

assert {:ok,
        %{
          data: %{
            "docsDequeuePreview" => %{
              "requiresConfirmation" => true,
              "confirmation" => refreshed_proof
            }
          }
        }} =
         Absinthe.run(preview_query, GroupherServerWeb.Schema,
           variables: preview_variables,
           context: %{cur_user: actor}
         )

assert {:ok, %{data: %{"dequeueDocs" => %{"queueRevision" => 9}}}} =
         Absinthe.run(dequeue_mutation, GroupherServerWeb.Schema,
           variables: Map.put(dequeue_variables, "confirmation", refreshed_proof),
           context: %{cur_user: actor}
         )

assert %{revision: 3, title: "D edit"} = Repo.get!(ArticleWorkingCopy, pending_work)
assert Repo.get(ArticleWorkingCopy, copy.id) == nil
assert Repo.get_by!(DocsLifecycle, article_id: pending_id).state == :draft
assert Repo.get_by!(DocsTreeNode, community_id: site.id, stage: :draft, doc_id: pending_id)
assert Repo.get_by(CMS.Model.DocsQueueArticle, queue_id: queue.id, article_id: pending_id) == nil

assert {:ok, %{queue_revision: 10}} =
         Enqueue.execute(
           site,
           9,
           [%{article_id: pending_id, default_revision: 3}],
           actor,
           Ecto.UUID.generate()
         )

{:ok, queue} = Queue.read(site)
member = Repo.get_by!(CMS.Model.DocsQueueArticle, queue_id: queue.id, article_id: pending_id)
copy = Repo.get!(ArticleWorkingCopy, member.working_copy_id)

assert {:ok, %{queue: %{queue_revision: 11}}} =
         Repo.transact(fn ->
           Queue.save(site, queue, 10, pending_id, copy.revision, %{title: "Shared edit"}, actor)
         end)

assert {:ok, %{revision: 4}} =
         CMS.Articles.Commands.SaveWorkingCopy.execute(
           pending_article,
           site,
           pending_work,
           %{title: "Shared edit"},
           3,
           actor,
           Ecto.UUID.generate()
         )

preview_variables = Map.put(preview_variables, "revision", 11)

assert {:ok, %{data: %{"docsDequeuePreview" => %{"requiresConfirmation" => false}}}} =
         Absinthe.run(preview_query, GroupherServerWeb.Schema,
           variables: preview_variables,
           context: %{cur_user: actor}
         )

assert {:ok, %{data: %{"dequeueDocs" => %{"queueRevision" => 12}}}} =
         Absinthe.run(dequeue_mutation, GroupherServerWeb.Schema,
           variables: Map.merge(preview_variables, %{"commandId" => Ecto.UUID.generate()}),
           context: %{cur_user: actor}
         )

assert %{revision: 4, title: "Shared edit"} = Repo.get!(ArticleWorkingCopy, pending_work)

assert Repo.get_by(CMS.Model.DocsQueueTreeChange,
         queue_id: queue.id,
         node_id:
           Repo.get_by!(DocsTreeNode, community_id: site.id, stage: :draft, doc_id: pending_id).node_id
       ) == nil

assert {:ok, %{working_copy_id: edit_id}} =
         CMS.DocTree.Commands.BeginEdit.execute(
           site,
           article.id,
           Repo.get!(CMS.Model.ArticlePublic, article.id).snapshot_id,
           actor,
           Ecto.UUID.generate()
         )

page = Map.put(page, "workingCopyId", edit_id)
default = Repo.get!(ArticleWorkingCopy, edit_id)

assert {:ok, updated_default} =
         CMS.Articles.Commands.SaveWorkingCopy.execute(
           article,
           site,
           default.id,
           %{title: "Republished"},
           default.revision,
           actor,
           Ecto.UUID.generate()
         )

assert {:ok, %{queue_revision: 13}} =
         Enqueue.execute(
           site,
           12,
           [%{article_id: article.id, default_revision: updated_default.revision}],
           actor,
           Ecto.UUID.generate()
         )

assert {:ok, %{data: %{"releaseDocsQueue" => %{"queueRevision" => 14}}}} =
         Absinthe.run(release_mutation, GroupherServerWeb.Schema,
           variables: %{
             "community" => site.slug,
             "revision" => 13,
             "commandId" => Ecto.UUID.generate()
           },
           context: %{cur_user: actor}
         )

assert %{replaced_at: replaced_at, outdated_at: outdated_at} =
         Repo.get!(CMS.Model.ArtimentReview, request.id)

assert replaced_at && outdated_at

assert {:ok, :stale} =
         Repo.transact(fn ->
           CMS.Review.Results.apply_in_transaction(request.id, %{"status" => "clear"})
         end)

assert {:error, _} =
         Repo.transact(fn -> CMS.Review.Target.validate_report_target_in_transaction(report) end)

current_request =
  Repo.one!(
    from(r in CMS.Model.ArtimentReview,
      where: r.target_type == :doc and r.article_id == ^article.id and is_nil(r.replaced_at)
    )
  )

assert current_request.id != request.id

assert {:ok, _} =
         Repo.transact(fn -> CMS.Review.Requests.claim_in_transaction(current_request.id) end)

assert {:ok, %{state: :completed}} =
         Repo.transact(fn ->
           CMS.Review.Results.apply_in_transaction(current_request.id, %{
             "status" => "suspect",
             "summary" => "Possible spam",
             "sus_notes" => [%{"type" => "spam", "evidence" => "x", "explanation" => "test"}]
           })
         end)

assert {:error, _} = CMS.FrontDesk.Article.read_stable(site, :doc, binding.inner_id, nil, [])

reviewer = %{reporter | cur_passport: %{"global" => %{"review.platform.decide" => true}}}

approve_mutation = """
mutation ApproveDoc($target: CmsReviewTargetInput!, $commandId: ID!) {
  approveDocV2(target: $target, commandId: $commandId) { targetId action }
}
"""

assert {:ok, %{data: %{"approveDocV2" => %{"targetId" => target_id, "action" => "APPROVE"}}}} =
         Absinthe.run(approve_mutation, GroupherServerWeb.Schema,
           variables: %{
             "target" => %{"type" => "DOC", "articleId" => article.id},
             "commandId" => Ecto.UUID.generate()
           },
           context: %{cur_user: reviewer}
         )

assert target_id == article.id

assert {:ok, %{article_id: _}} =
         CMS.FrontDesk.Article.read_stable(site, :doc, binding.inner_id, nil, [])

recheck_mutation = """
mutation RecheckDoc($target: CmsReviewTargetInput!, $scope: ReviewBotScopeInput!, $commandId: ID!) {
  recheckDocV2(target: $target, scope: $scope, commandId: $commandId) { targetId action }
}
"""

assert {:ok, %{data: %{"recheckDocV2" => %{"targetId" => recheck_id, "action" => "RECHECK"}}}} =
         Absinthe.run(recheck_mutation, GroupherServerWeb.Schema,
           variables: %{
             "target" => %{"type" => "DOC", "articleId" => article.id},
             "scope" => %{"type" => "PLATFORM"},
             "commandId" => Ecto.UUID.generate()
           },
           context: %{cur_user: reviewer}
         )

assert recheck_id == article.id

assert {:ok, %{working_copy_id: edit_id}} =
         CMS.DocTree.Commands.BeginEdit.execute(
           site,
           article.id,
           Repo.get!(CMS.Model.ArticlePublic, article.id).snapshot_id,
           actor,
           Ecto.UUID.generate()
         )

page = Map.put(page, "workingCopyId", edit_id)

# Trash membership blocks workspace writes while the published head remains
# readable until the queued deletion itself is released.
now = DateTime.utc_now(:second)

trash =
  %CMS.Model.TrashAction{}
  |> CMS.Model.TrashAction.changeset(%{
    community_id: site.id,
    actor_id: actor.id,
    root_type: "doc",
    root_ref: article.id,
    deleted_at: now,
    scheduled_permanent_deletion_at: DateTime.add(now, 30 * 86_400, :second)
  })
  |> Repo.insert!()

_trashed_doc =
  %CMS.Model.DocsTrashedArticle{}
  |> CMS.Model.DocsTrashedArticle.changeset(%{
    trash_action_id: trash.id,
    community_id: site.id,
    article_id: article.id,
    restore_state: :published,
    deleted_by_id: actor.id,
    deleted_at: now
  })
  |> Repo.insert!()

_trashed_node =
  %CMS.Model.DocsTrashedTreeNode{}
  |> CMS.Model.DocsTrashedTreeNode.changeset(%{
    trash_action_id: trash.id,
    community_id: site.id,
    node_id: page["nodeId"],
    doc_id: article.id,
    type: :page,
    draft_snapshot: %{"node_id" => page["nodeId"], "doc_id" => article.id},
    deleted_by_id: actor.id,
    deleted_at: now
  })
  |> Repo.insert!()

default = Repo.get!(ArticleWorkingCopy, page["workingCopyId"])

assert {:error, _} =
         CMS.Articles.Commands.SaveWorkingCopy.execute(
           article,
           site,
           default.id,
           %{title: "Should be denied"},
           default.revision,
           actor,
           Ecto.UUID.generate()
         )

assert {:error, _} =
         Enqueue.execute(
           site,
           14,
           [%{article_id: article.id, default_revision: default.revision}],
           actor,
           Ecto.UUID.generate()
         )

assert {:ok, %{article_id: _}} =
         CMS.FrontDesk.Article.read_stable(site, :doc, binding.inner_id, nil, [])

{1, _} =
  Repo.delete_all(from(t in CMS.Model.DocsTrashedArticle, where: t.article_id == ^article.id))

{1, _} =
  Repo.delete_all(from(t in CMS.Model.DocsTrashedTreeNode, where: t.trash_action_id == ^trash.id))

Repo.delete!(trash)

assert {:ok, _} =
         CMS.Articles.Commands.SaveWorkingCopy.execute(
           article,
           site,
           default.id,
           %{title: "Restored edit"},
           default.revision,
           actor,
           Ecto.UUID.generate()
         )

{:ok, _} =
  CMS.Passport.stamp_passport(
    %{
      "global" => %{},
      site.slug => %{
        "cms" => %{
          "doc.trash" => true,
          "doc.restore" => true,
          "doc.permanent_delete" => true,
          "doc.queue.write" => true,
          "doc.queue.preview" => true,
          "doc.queue.publish" => true
        }
      }
    },
    actor
  )

assert {:ok, %{queue_revision: 15}} =
         Enqueue.execute(
           site,
           14,
           [%{article_id: pending_id, default_revision: 4}],
           actor,
           Ecto.UUID.generate()
         )

{:ok, queue} = Queue.read(site)
member = Repo.get_by!(CMS.Model.DocsQueueArticle, queue_id: queue.id, article_id: pending_id)
copy = Repo.get!(ArticleWorkingCopy, member.working_copy_id)

assert {:ok, %{queue: %{queue_revision: 16}}} =
         Repo.transact(fn ->
           Queue.save(site, queue, 15, pending_id, copy.revision, %{title: "Queue only"}, actor)
         end)

pending_node =
  Repo.get_by!(DocsTreeNode, community_id: site.id, stage: :draft, doc_id: pending_id)

assert {:ok,
        %{
          requires_confirmation: true,
          confirmation: delete_proof,
          draft_count: 1,
          public_count: 1
        }} =
         Repo.transact(fn ->
           with {:ok, queue} <- Queue.lock_or_create(site) do
             CMS.DocTree.WorkspaceDelete.preview(site, queue, 7, 16, group, actor)
           end
         end)

assert {:ok, %{revision: 5}} =
         CMS.Articles.Commands.SaveWorkingCopy.execute(
           pending_article,
           site,
           pending_work,
           %{title: "Changed after preview"},
           4,
           actor,
           Ecto.UUID.generate()
         )

assert {:error, :stale_discard_confirmation} =
         Repo.transact(fn ->
           with {:ok, queue} <- Queue.lock_or_create(site) do
             CMS.DocTree.WorkspaceDelete.run(site, queue, 7, 16, group, delete_proof, actor)
           end
         end)

delete_preview_query = """
query DeletePreview($community: String!, $tree: Int!, $queue: Int!, $node: ID!) {
  docsWorkspaceDeletePreview(community: $community, treeRevision: $tree, queueRevision: $queue, nodeId: $node) {
    requiresConfirmation confirmation { formatVersion hash } publicCount draftCount
  }
}
"""

delete_vars = %{"community" => site.slug, "tree" => 7, "queue" => 16, "node" => group}

assert {:ok, %{errors: [_ | _]}} =
         Absinthe.run(delete_preview_query, GroupherServerWeb.Schema,
           variables: delete_vars,
           context: %{cur_user: outsider}
         )

assert {:ok,
        %{
          data: %{
            "docsWorkspaceDeletePreview" => %{
              "requiresConfirmation" => true,
              "confirmation" => proof,
              "publicCount" => 1,
              "draftCount" => 1
            }
          }
        }} =
         Absinthe.run(delete_preview_query, GroupherServerWeb.Schema,
           variables: delete_vars,
           context: %{cur_user: actor}
         )

assert {:error, {:discard_confirmation_required, _}} =
         Repo.transact(fn ->
           with {:ok, queue} <- Queue.lock_or_create(site) do
             CMS.DocTree.WorkspaceDelete.run(site, queue, 7, 16, group, nil, actor)
           end
         end)

assert Repo.get!(ArticleWorkingCopy, copy.id)

delete_command = Ecto.UUID.generate()

delete_mutation = """
mutation DeleteWorkspace($community: String!, $tree: Int!, $queue: Int!, $node: ID!, $commandId: ID!, $proof: DocsDiscardConfirmationInput) {
  deleteDocsWorkspaceNode(community: $community, treeRevision: $tree, queueRevision: $queue, nodeId: $node, commandId: $commandId, confirmation: $proof) {
    trashActionId treeRevision queueRevision
  }
}
"""

delete_vars = Map.merge(delete_vars, %{"commandId" => delete_command, "proof" => proof})

assert {:ok, %{errors: [_ | _]}} =
         Absinthe.run(delete_mutation, GroupherServerWeb.Schema,
           variables: delete_vars,
           context: %{cur_user: outsider}
         )

assert {:ok,
        %{
          data: %{
            "deleteDocsWorkspaceNode" =>
              %{"treeRevision" => 8, "queueRevision" => 17} = delete_result
          }
        }} =
         Absinthe.run(delete_mutation, GroupherServerWeb.Schema,
           variables: delete_vars,
           context: %{cur_user: actor}
         )

assert {:ok, %{data: %{"deleteDocsWorkspaceNode" => ^delete_result}}} =
         Absinthe.run(delete_mutation, GroupherServerWeb.Schema,
           variables: delete_vars,
           context: %{cur_user: actor}
         )

assert Repo.get!(ArticleWorkingCopy, pending_work)
assert Repo.get(ArticleWorkingCopy, copy.id) == nil
assert Repo.get_by!(CMS.Model.DocsTrashedArticle, article_id: pending_id)
assert Repo.get_by!(CMS.Model.DocsTrashedTreeNode, node_id: pending_node.node_id)

trash_query = """
query DocsTrash($community: String!) {
  docTreeTrashItems(community: $community) {
    entries { id nodeId title }
    pageInfo { __typename hasNextPage }
  }
}
"""

assert {:ok, %{errors: [_ | _]}} =
         Absinthe.run(trash_query, GroupherServerWeb.Schema,
           variables: %{"community" => site.slug},
           context: %{cur_user: outsider}
         )

assert {:ok, %{data: %{"docTreeTrashItems" => %{"entries" => trash_entries}}}} =
         Absinthe.run(trash_query, GroupherServerWeb.Schema,
           variables: %{"community" => site.slug},
           context: %{cur_user: actor}
         )

assert Enum.any?(
         trash_entries,
         &(&1["id"] == delete_result["trashActionId"] and &1["nodeId"] == group)
       )

assert {:ok, %{article_id: _}} =
         CMS.FrontDesk.Article.read_stable(site, :doc, binding.inner_id, nil, [])

restore_mutation = """
mutation RestoreWorkspace($community: String!, $tree: Int!, $queue: Int!, $action: ID!, $commandId: ID!, $parent: ID, $position: Int) {
  restoreDocsWorkspaceNode(community: $community, treeRevision: $tree, queueRevision: $queue, trashActionId: $action, commandId: $commandId, targetParentNodeId: $parent, targetIndex: $position) {
    nodeId treeRevision queueRevision
  }
}
"""

restore_vars = %{
  "community" => site.slug,
  "tree" => 8,
  "queue" => 17,
  "action" => delete_result["trashActionId"],
  "commandId" => Ecto.UUID.generate()
}

assert {:ok, %{errors: [_ | _]}} =
         Absinthe.run(restore_mutation, GroupherServerWeb.Schema,
           variables: restore_vars,
           context: %{cur_user: outsider}
         )

assert {:ok,
        %{
          data: %{
            "restoreDocsWorkspaceNode" =>
              %{"treeRevision" => 9, "queueRevision" => 18, "nodeId" => ^group} = restore_result
          }
        }} =
         Absinthe.run(restore_mutation, GroupherServerWeb.Schema,
           variables: restore_vars,
           context: %{cur_user: actor}
         )

assert {:ok, %{data: %{"restoreDocsWorkspaceNode" => ^restore_result}}} =
         Absinthe.run(restore_mutation, GroupherServerWeb.Schema,
           variables: restore_vars,
           context: %{cur_user: actor}
         )

assert Repo.get_by!(DocsTreeNode, community_id: site.id, stage: :draft, doc_id: pending_id)
assert Repo.get_by!(DocsTreeNode, community_id: site.id, stage: :draft, doc_id: article.id)
assert Repo.get_by(CMS.Model.DocsTrashedArticle, article_id: pending_id) == nil
assert Repo.get_by(CMS.Model.DocsQueueArticle, queue_id: queue.id, article_id: pending_id) == nil
assert {:ok, %{tabs: [%{groups: [_ | _]}]}} = CMS.DocTree.read_public(site)

second_delete_vars =
  Map.merge(delete_vars, %{
    "tree" => 9,
    "queue" => 18,
    "commandId" => Ecto.UUID.generate(),
    "proof" => nil
  })

assert {:ok,
        %{
          data: %{
            "deleteDocsWorkspaceNode" =>
              %{"treeRevision" => 10, "queueRevision" => 19} = second_delete
          }
        }} =
         Absinthe.run(delete_mutation, GroupherServerWeb.Schema,
           variables: second_delete_vars,
           context: %{cur_user: actor}
         )

assert {:ok, %{data: %{"releaseDocsQueue" => %{"queueRevision" => 20}}}} =
         Absinthe.run(release_mutation, GroupherServerWeb.Schema,
           variables: %{
             "community" => site.slug,
             "revision" => 19,
             "commandId" => Ecto.UUID.generate()
           },
           context: %{cur_user: actor}
         )

assert {:error, _} = CMS.FrontDesk.Article.read_stable(site, :doc, binding.inner_id, nil, [])
assert Repo.get_by!(CMS.Model.DocsTrashedArticle, article_id: article.id)

assert Repo.exists?(
         from(e in CMS.Outbox.Event,
           where: e.event == "article.visibility_changed" and e.resource_id == ^article.id
         )
       )

first_published_at = Repo.get_by!(DocsLifecycle, article_id: article.id).first_published_at

restore_vars =
  Map.merge(restore_vars, %{
    "tree" => 10,
    "queue" => 20,
    "action" => second_delete["trashActionId"],
    "commandId" => Ecto.UUID.generate()
  })

assert {:ok,
        %{data: %{"restoreDocsWorkspaceNode" => %{"treeRevision" => 11, "queueRevision" => 20}}}} =
         Absinthe.run(restore_mutation, GroupherServerWeb.Schema,
           variables: restore_vars,
           context: %{cur_user: actor}
         )

assert %{state: :draft, first_published_at: ^first_published_at} =
         Repo.get_by!(DocsLifecycle, article_id: article.id)

page =
  Map.put(
    page,
    "workingCopyId",
    Repo.get_by!(DocsLifecycle, article_id: article.id).default_working_copy_id
  )

assert Repo.get!(ArticleWorkingCopy, page["workingCopyId"])
assert {:error, _} = CMS.FrontDesk.Article.read_stable(site, :doc, binding.inner_id, nil, [])

assert {:ok, %{queue_revision: 21}} =
         Enqueue.execute(
           site,
           20,
           [
             %{
               article_id: article.id,
               default_revision: Repo.get!(ArticleWorkingCopy, page["workingCopyId"]).revision
             }
           ],
           actor,
           Ecto.UUID.generate()
         )

assert {:ok, %{data: %{"releaseDocsQueue" => %{"queueRevision" => 22}}}} =
         Absinthe.run(release_mutation, GroupherServerWeb.Schema,
           variables: %{
             "community" => site.slug,
             "revision" => 21,
             "commandId" => Ecto.UUID.generate()
           },
           context: %{cur_user: actor}
         )

assert %{state: :published, first_published_at: ^first_published_at} =
         Repo.get_by!(DocsLifecycle, article_id: article.id)

assert {:ok, %{article_id: _}} =
         CMS.FrontDesk.Article.read_stable(site, :doc, binding.inner_id, nil, [])

assert {:ok, %{tree_revision: 12}} =
         Repo.transact(fn ->
           with {:ok, queue} <- Queue.lock_or_create(site) do
             CMS.DocTree.WorkspaceUpdate.run(
               site,
               queue,
               11,
               group,
               %{title: "Queued group edit"},
               actor
             )
           end
         end)

assert {:ok, %{queue_revision: 23}} = Queue.read(site)

third_delete_vars =
  Map.merge(delete_vars, %{
    "tree" => 12,
    "queue" => 23,
    "commandId" => Ecto.UUID.generate(),
    "proof" => nil
  })

assert {:ok,
        %{
          data: %{
            "deleteDocsWorkspaceNode" =>
              %{"treeRevision" => 13, "queueRevision" => 24} = third_delete
          }
        }} =
         Absinthe.run(delete_mutation, GroupherServerWeb.Schema,
           variables: third_delete_vars,
           context: %{cur_user: actor}
         )

third_restore_vars =
  Map.merge(restore_vars, %{
    "tree" => 13,
    "queue" => 24,
    "action" => third_delete["trashActionId"],
    "commandId" => Ecto.UUID.generate()
  })

assert {:ok,
        %{data: %{"restoreDocsWorkspaceNode" => %{"treeRevision" => 14, "queueRevision" => 25}}}} =
         Absinthe.run(restore_mutation, GroupherServerWeb.Schema,
           variables: third_restore_vars,
           context: %{cur_user: actor}
         )

assert %{target: %{"title" => "Queued group edit"}} =
         Repo.get_by!(CMS.Model.DocsQueueTreeChange, queue_id: queue.id, node_id: group)

assert {:ok, %{node_id: alternate, tree_revision: 15}} =
         CreateWorkspaceNode.execute(
           site,
           14,
           %{type: :group, title: "Alternate", parent_node_id: tab},
           actor,
           Ecto.UUID.generate()
         )

child_delete_vars =
  Map.merge(delete_vars, %{
    "tree" => 15,
    "queue" => 25,
    "node" => pending_node.node_id,
    "commandId" => Ecto.UUID.generate(),
    "proof" => nil
  })

assert {:ok,
        %{
          data: %{
            "deleteDocsWorkspaceNode" =>
              %{"treeRevision" => 16, "queueRevision" => 25} = child_delete
          }
        }} =
         Absinthe.run(delete_mutation, GroupherServerWeb.Schema,
           variables: child_delete_vars,
           context: %{cur_user: actor}
         )

parent_delete_vars =
  Map.merge(delete_vars, %{
    "tree" => 16,
    "queue" => 25,
    "node" => group,
    "commandId" => Ecto.UUID.generate(),
    "proof" => nil
  })

assert {:ok,
        %{
          data: %{
            "deleteDocsWorkspaceNode" =>
              %{"treeRevision" => 17, "queueRevision" => 26} = parent_delete
          }
        }} =
         Absinthe.run(delete_mutation, GroupherServerWeb.Schema,
           variables: parent_delete_vars,
           context: %{cur_user: actor}
         )

child_restore_vars =
  Map.merge(restore_vars, %{
    "tree" => 17,
    "queue" => 26,
    "action" => child_delete["trashActionId"],
    "commandId" => Ecto.UUID.generate()
  })

assert {:ok, %{errors: [_ | _]}} =
         Absinthe.run(restore_mutation, GroupherServerWeb.Schema,
           variables: child_restore_vars,
           context: %{cur_user: actor}
         )

child_restore_vars =
  Map.merge(child_restore_vars, %{
    "commandId" => Ecto.UUID.generate(),
    "parent" => alternate,
    "position" => 0
  })

assert {:ok,
        %{data: %{"restoreDocsWorkspaceNode" => %{"treeRevision" => 18, "queueRevision" => 26}}}} =
         Absinthe.run(restore_mutation, GroupherServerWeb.Schema,
           variables: child_restore_vars,
           context: %{cur_user: actor}
         )

assert %{parent_node_id: ^alternate} =
         Repo.get_by!(DocsTreeNode, community_id: site.id, stage: :draft, doc_id: pending_id)

purge_mutation = """
mutation PurgeDocsTrash($community: String!, $queue: Int!, $action: ID!, $commandId: ID!) {
  purgeDocsWorkspaceTrash(community: $community, queueRevision: $queue, trashActionId: $action, commandId: $commandId) { done }
}
"""

purge_vars = %{
  "community" => site.slug,
  "queue" => 26,
  "action" => parent_delete["trashActionId"],
  "commandId" => Ecto.UUID.generate()
}

assert {:ok, %{errors: [_ | _]}} =
         Absinthe.run(purge_mutation, GroupherServerWeb.Schema,
           variables: purge_vars,
           context: %{cur_user: outsider}
         )

assert {:ok, %{errors: [%{extensions: %{code: 4574}} | _]}} =
         Absinthe.run(purge_mutation, GroupherServerWeb.Schema,
           variables: purge_vars,
           context: %{cur_user: actor}
         )

scheduled_action = Repo.get_by!(CMS.Model.TrashAction, hash_id: parent_delete["trashActionId"])
scheduled_purge = CMS.DocTree.Commands.PurgeWorkspaceTrash

assert {:error, :docs_trash_not_due} =
         scheduled_purge.execute_due(scheduled_action, DateTime.utc_now(:second))

assert {:error, :docs_trash_in_use} =
         scheduled_purge.execute_due(
           scheduled_action,
           scheduled_action.scheduled_permanent_deletion_at
         )

assert Repo.get(ArticleWorkingCopy, page["workingCopyId"]) == nil
assert Repo.get_by!(CMS.Model.TrashAction, hash_id: scheduled_action.hash_id)

snapshot_id = Repo.get!(CMS.Model.ArticlePublic, article.id).snapshot_id

assert {:ok, %{data: %{"releaseDocsQueue" => %{"queueRevision" => 27}}}} =
         Absinthe.run(release_mutation, GroupherServerWeb.Schema,
           variables: %{
             "community" => site.slug,
             "revision" => 26,
             "commandId" => Ecto.UUID.generate()
           },
           context: %{cur_user: actor}
         )

purge_vars = Map.merge(purge_vars, %{"queue" => 27, "commandId" => Ecto.UUID.generate()})

original_action = Repo.get_by!(CMS.Model.TrashAction, hash_id: parent_delete["trashActionId"])

assert {:error, :docs_trash_requires_workspace_command} =
         CMS.Trash.permanently_delete_action(original_action, actor)

original_node =
  Repo.get_by!(CMS.Model.DocsTrashedTreeNode,
    trash_action_id: original_action.id,
    doc_id: article.id
  )

other_action =
  %CMS.Model.TrashAction{}
  |> CMS.Model.TrashAction.changeset(%{
    community_id: site.id,
    root_type: original_action.root_type,
    root_ref: "other-#{Ecto.UUID.generate()}",
    deleted_at: original_action.deleted_at,
    scheduled_permanent_deletion_at: original_action.scheduled_permanent_deletion_at
  })
  |> Repo.insert!()

other_node =
  %CMS.Model.DocsTrashedTreeNode{}
  |> CMS.Model.DocsTrashedTreeNode.changeset(%{
    trash_action_id: other_action.id,
    community_id: site.id,
    node_id: original_node.node_id,
    doc_id: original_node.doc_id,
    type: original_node.type,
    queue_snapshot: original_node.queue_snapshot || original_node.draft_snapshot,
    deleted_at: original_node.deleted_at
  })
  |> Repo.insert!()

assert {:ok, %{errors: [%{extensions: %{code: 4574}} | _]}} =
         Absinthe.run(purge_mutation, GroupherServerWeb.Schema,
           variables: purge_vars,
           context: %{cur_user: actor}
         )

assert {:error, :docs_trash_in_use} =
         scheduled_purge.execute_due(
           original_action,
           original_action.scheduled_permanent_deletion_at
         )

Repo.delete!(other_node)
Repo.delete!(other_action)
purge_vars = Map.put(purge_vars, "commandId", Ecto.UUID.generate())

assert {:ok, %{data: %{"purgeDocsWorkspaceTrash" => %{"done" => true}}}} =
         Absinthe.run(purge_mutation, GroupherServerWeb.Schema,
           variables: purge_vars,
           context: %{cur_user: actor}
         )

assert {:ok, %{data: %{"purgeDocsWorkspaceTrash" => %{"done" => true}}}} =
         Absinthe.run(purge_mutation, GroupherServerWeb.Schema,
           variables: purge_vars,
           context: %{cur_user: actor}
         )

assert Repo.get!(Article, article.id)
assert Repo.get!(CMS.Model.ArticleSnapshot, snapshot_id)
assert Repo.get(ArticleWorkingCopy, page["workingCopyId"]) == nil
assert Repo.get_by(DocsLifecycle, article_id: article.id) == nil
assert {:error, _} = CMS.FrontDesk.Article.read_stable(site, :doc, binding.inner_id, nil, [])

assert {:error, _} =
         CMS.Press.Query.article(%{
           community: site.slug,
           thread: :doc,
           inner_id: binding.inner_id
         })

assert {:ok, %{items: press_items_after_purge}} = CMS.Press.Query.thread_rss_feed(site, :doc, [])
refute Enum.any?(press_items_after_purge, &(&1.item_id == article.id))
visible_bindings = CMS.Articles.Pagination.public_binding_ids(:doc)

refute Repo.exists?(
         from(b in CMS.Model.ArticleBinding,
           where: b.id == ^binding.id and b.id in subquery(visible_bindings)
         )
       )

unpublished_delete_vars =
  Map.merge(delete_vars, %{
    "tree" => 18,
    "queue" => 27,
    "node" => pending_node.node_id,
    "commandId" => Ecto.UUID.generate(),
    "proof" => nil
  })

assert {:ok,
        %{
          data: %{
            "deleteDocsWorkspaceNode" =>
              %{"treeRevision" => 19, "queueRevision" => 27} = unpublished_delete
          }
        }} =
         Absinthe.run(delete_mutation, GroupherServerWeb.Schema,
           variables: unpublished_delete_vars,
           context: %{cur_user: actor}
         )

unpublished_action =
  Repo.get_by!(CMS.Model.TrashAction, hash_id: unpublished_delete["trashActionId"])

now = DateTime.utc_now(:second)

unpublished_action
|> Ecto.Changeset.change(scheduled_permanent_deletion_at: now)
|> Repo.update!()

assert {:ok, %{deleted: deleted, failed: []}} = CMS.Trash.purge_due(now: now)
assert deleted >= 1
assert {:ok, :already_removed} = scheduled_purge.execute_due(unpublished_action, now)

assert Repo.get!(Article, pending_id)
assert Repo.get(ArticleWorkingCopy, pending_work) == nil
assert Repo.get_by(DocsLifecycle, article_id: pending_id) == nil

IO.puts("Docs workspace, release, review, move and confirmed dequeue verified")

# Exercise a real release that leaves D in conflict with the published Queue Snapshot.
assert {:ok, %{node_id: conflict_tab, tree_revision: 20}} =
         CreateWorkspaceNode.execute(
           site,
           19,
           %{type: :tab, title: "Conflict tab"},
           actor,
           Ecto.UUID.generate()
         )

assert {:ok, %{node_id: conflict_group, tree_revision: 21}} =
         CreateWorkspaceNode.execute(
           site,
           20,
           %{type: :group, title: "Conflict group", parent_node_id: conflict_tab},
           actor,
           Ecto.UUID.generate()
         )

assert {:ok,
        %{article_id: conflict_article_id, working_copy_id: conflict_work_id, tree_revision: 22}} =
         CreateWorkspaceNode.execute(
           site,
           21,
           %{type: :page, title: "Conflict page", parent_node_id: conflict_group},
           actor,
           Ecto.UUID.generate()
         )

conflict_article = Repo.get!(Article, conflict_article_id)

assert {:ok, %{revision: 2}} =
         CMS.Articles.Commands.SaveWorkingCopy.execute(
           conflict_article,
           site,
           conflict_work_id,
           %{body_bag: body},
           1,
           actor,
           Ecto.UUID.generate()
         )

assert {:ok, %{queue_revision: 28}} =
         Enqueue.execute(
           site,
           27,
           [%{article_id: conflict_article_id, default_revision: 2}],
           actor,
           Ecto.UUID.generate()
         )

conflict_member = Repo.get_by!(CMS.Model.DocsQueueArticle, article_id: conflict_article_id)
conflict_q = Repo.get!(ArticleWorkingCopy, conflict_member.working_copy_id)

assert {:ok, %{queue_revision: 29}} =
         CMS.DocTree.Commands.SaveQueue.execute(
           site,
           28,
           conflict_article_id,
           conflict_q.revision,
           %{title: "Published choice"},
           actor,
           Ecto.UUID.generate()
         )

assert {:ok, %{revision: 3}} =
         CMS.Articles.Commands.SaveWorkingCopy.execute(
           conflict_article,
           site,
           conflict_work_id,
           %{title: "Default choice"},
           2,
           actor,
           Ecto.UUID.generate()
         )

assert {:ok, %{queue_revision: 30}} =
         CMS.DocTree.Commands.ReleaseQueue.execute(site, 29, actor, Ecto.UUID.generate())

conflict_query = """
query Conflict($community: String!, $article: ID!) {
  docsPostPublishConflict(community: $community, articleId: $article) { publicSnapshotId defaultRevision }
}
"""

conflict_query_vars = %{"community" => site.slug, "article" => conflict_article_id}

assert {:ok, %{errors: [_ | _]}} =
         Absinthe.run(conflict_query, GroupherServerWeb.Schema,
           variables: conflict_query_vars,
           context: %{cur_user: outsider}
         )

assert {:ok,
        %{
          data: %{
            "docsPostPublishConflict" => %{
              "publicSnapshotId" => public_snapshot_id,
              "defaultRevision" => 3
            }
          }
        }} =
         Absinthe.run(conflict_query, GroupherServerWeb.Schema,
           variables: conflict_query_vars,
           context: %{cur_user: actor}
         )

resolve_mutation = """
mutation Resolve($community: String!, $article: ID!, $work: ID!, $revision: Int!, $snapshot: ID!, $choices: [DocsMergeChoiceInput!]!, $commandId: ID!) {
  resolveDocsPostPublish(community: $community, articleId: $article, workingCopyId: $work, defaultRevision: $revision, publicSnapshotId: $snapshot, choices: $choices, commandId: $commandId) { workingCopyRevision conflictFields }
}
"""

resolve_vars = %{
  "work" => conflict_work_id,
  "community" => site.slug,
  "article" => conflict_article_id,
  "revision" => 3,
  "snapshot" => public_snapshot_id,
  "choices" => [],
  "commandId" => Ecto.UUID.generate()
}

assert {:ok, %{data: %{"resolveDocsPostPublish" => %{"conflictFields" => ["TITLE"]}}}} =
         Absinthe.run(resolve_mutation, GroupherServerWeb.Schema,
           variables: resolve_vars,
           context: %{cur_user: actor}
         )

assert {:ok, %{errors: [%{extensions: %{code: 4569}} | _]}} =
         Absinthe.run(resolve_mutation, GroupherServerWeb.Schema,
           variables:
             Map.merge(resolve_vars, %{"revision" => 2, "commandId" => Ecto.UUID.generate()}),
           context: %{cur_user: actor}
         )

resolved_vars =
  Map.merge(resolve_vars, %{
    "choices" => [%{"field" => "TITLE", "side" => "SOURCE"}],
    "commandId" => Ecto.UUID.generate()
  })

assert {:ok,
        %{
          data: %{
            "resolveDocsPostPublish" => %{"workingCopyRevision" => nil, "conflictFields" => nil}
          }
        }} =
         Absinthe.run(resolve_mutation, GroupherServerWeb.Schema,
           variables: resolved_vars,
           context: %{cur_user: actor}
         )

assert {:ok, %{data: %{"resolveDocsPostPublish" => %{"workingCopyRevision" => nil}}}} =
         Absinthe.run(resolve_mutation, GroupherServerWeb.Schema,
           variables: resolved_vars,
           context: %{cur_user: actor}
         )

assert Repo.get(ArticleWorkingCopy, conflict_work_id) == nil

assert {:error, _} =
         CMS.Articles.Commands.SaveWorkingCopy.execute(
           conflict_article,
           site,
           conflict_work_id,
           %{title: "Stale editor"},
           3,
           actor,
           Ecto.UUID.generate()
         )

assert Repo.get(ArticleWorkingCopy, conflict_work_id) == nil

assert {:ok, %{data: %{"docsPostPublishConflict" => nil}}} =
         Absinthe.run(conflict_query, GroupherServerWeb.Schema,
           variables: conflict_query_vars,
           context: %{cur_user: actor}
         )

IO.puts("Docs post-publication GraphQL conflict resolved")

assert {:ok, %{revision: edit_revision}} =
         CMS.DocTree.Commands.BeginEdit.execute(
           site,
           conflict_article_id,
           Repo.get!(CMS.Model.ArticlePublic, conflict_article_id).snapshot_id,
           actor,
           Ecto.UUID.generate()
         )

assert {:ok, %{queue_revision: 31}} =
         Enqueue.execute(
           site,
           30,
           [%{article_id: conflict_article_id, default_revision: edit_revision}],
           actor,
           Ecto.UUID.generate()
         )

assert {:ok, %{changed?: true}} =
         Repo.transact(fn ->
           with {:ok, queue} <- Queue.lock_or_create(site) do
             Queue.set_policy(site, queue, 0, true, false)
           end
         end)

approval_status_query = """
query QueueApprovalStatus($community: String!) {
  docsPublishQueue(community: $community) { revision approvalRequired approvalPolicyRevision approvalStatus }
}
"""

assert {:ok,
        %{
          data: %{
            "docsPublishQueue" => %{
              "revision" => 31,
              "approvalRequired" => true,
              "approvalPolicyRevision" => 1,
              "approvalStatus" => "PENDING"
            }
          }
        }} =
         Absinthe.run(approval_status_query, GroupherServerWeb.Schema,
           variables: %{"community" => site.slug},
           context: %{cur_user: actor}
         )

assert {:ok, _} =
         CMS.Passport.stamp_passport(
           %{"global" => %{}, site.slug => %{"cms" => %{"doc.queue.approve" => true}}},
           actor
         )

assert {:error, :docs_self_approval_forbidden} =
         CMS.DocTree.Commands.ApproveQueue.execute(site, 31, actor, Ecto.UUID.generate())

assert {:error, _} =
         CMS.DocTree.Commands.ApproveQueue.execute(site, 31, outsider, Ecto.UUID.generate())

{:ok, approver} = db_insert(:user)

assert {:ok, _} =
         CMS.Passport.stamp_passport(
           %{
             "global" => %{},
             site.slug => %{
               "cms" => %{
                 "doc.queue.approve" => true,
                 "doc.queue.preview" => true,
                 "doc.edit" => true
               }
             }
           },
           approver
         )

approval_command = Ecto.UUID.generate()

approve_mutation = """
mutation ApproveQueue($community: String!, $revision: Int!, $commandId: ID!) {
  approveDocsQueue(community: $community, queueRevision: $revision, commandId: $commandId) { approvalId queueRevision }
}
"""

approve_vars = %{"community" => site.slug, "revision" => 31, "commandId" => approval_command}

assert {:ok, %{errors: [%{extensions: %{code: 4577}} | _]}} =
         Absinthe.run(approve_mutation, GroupherServerWeb.Schema,
           variables: Map.put(approve_vars, "commandId", Ecto.UUID.generate()),
           context: %{cur_user: actor}
         )

assert {:ok,
        %{
          data: %{
            "approveDocsQueue" =>
              %{"approvalId" => approval_id, "queueRevision" => 31} = approval_result
          }
        }} =
         Absinthe.run(approve_mutation, GroupherServerWeb.Schema,
           variables: approve_vars,
           context: %{cur_user: approver}
         )

assert {:ok, %{data: %{"approveDocsQueue" => ^approval_result}}} =
         Absinthe.run(approve_mutation, GroupherServerWeb.Schema,
           variables: approve_vars,
           context: %{cur_user: approver}
         )

assert Repo.get!(CMS.Model.DocsPublishApproval, approval_id).sealed

assert {:ok, %{data: %{"docsPublishQueue" => %{"approvalStatus" => "APPROVED"}}}} =
         Absinthe.run(approval_status_query, GroupherServerWeb.Schema,
           variables: %{"community" => site.slug},
           context: %{cur_user: actor}
         )

assert ExUnit.CaptureLog.capture_log(fn ->
         assert {:error, :approval_integrity_fixture} =
                  Repo.transaction(fn ->
                    member =
                      Repo.get_by!(CMS.Model.DocsQueueArticle, article_id: conflict_article_id)

                    changed = Repo.get!(ArticleWorkingCopy, member.working_copy_id)

                    changed
                    |> Ecto.Changeset.change(revision: changed.revision + 1)
                    |> Repo.update!()

                    assert {:ok,
                            %{
                              data: %{
                                "docsPublishQueue" => %{"approvalStatus" => "NEEDS_REAPPROVAL"}
                              }
                            }} =
                             Absinthe.run(approval_status_query, GroupherServerWeb.Schema,
                               variables: %{"community" => site.slug},
                               context: %{cur_user: actor}
                             )

                    Repo.rollback(:approval_integrity_fixture)
                  end)
       end) =~ "Docs approval plan mismatch"

assert {:error, _} =
         CMS.DocTree.Commands.ApproveQueue.execute(site, 30, approver, Ecto.UUID.generate())

assert {:ok, _} =
         CMS.Passport.stamp_passport(
           %{"global" => %{}, site.slug => %{"cms" => %{"doc.queue.write" => true}}},
           approver
         )

edited_member = Repo.get_by!(CMS.Model.DocsQueueArticle, article_id: conflict_article_id)
edited_copy = Repo.get!(ArticleWorkingCopy, edited_member.working_copy_id)

assert {:ok, %{queue_revision: 32}} =
         CMS.DocTree.Commands.SaveQueue.execute(
           site,
           31,
           conflict_article_id,
           edited_copy.revision,
           %{title: "Changed after approval"},
           approver,
           Ecto.UUID.generate()
         )

assert {:ok, %{data: %{"docsPublishQueue" => %{"approvalStatus" => "PENDING"}}}} =
         Absinthe.run(approval_status_query, GroupherServerWeb.Schema,
           variables: %{"community" => site.slug},
           context: %{cur_user: actor}
         )

public_before_stale_release = Repo.get!(CMS.Model.ArticlePublic, conflict_article_id).snapshot_id

assert {:error, :docs_approval_required} =
         CMS.DocTree.Commands.ReleaseQueue.execute(site, 32, actor, Ecto.UUID.generate())

assert {:ok, %{errors: [%{extensions: %{code: 4578}} | _]}} =
         Absinthe.run(release_mutation, GroupherServerWeb.Schema,
           variables: %{
             "community" => site.slug,
             "revision" => 32,
             "commandId" => Ecto.UUID.generate()
           },
           context: %{cur_user: actor}
         )

assert Repo.get!(CMS.Model.ArticlePublic, conflict_article_id).snapshot_id ==
         public_before_stale_release

assert Repo.get_by!(CMS.Model.DocsQueueArticle, article_id: conflict_article_id).working_copy_id ==
         edited_copy.id

assert {:error, :docs_self_approval_forbidden} =
         CMS.DocTree.Commands.ApproveQueue.execute(site, 32, actor, Ecto.UUID.generate())

assert {:error, :docs_self_approval_forbidden} =
         CMS.DocTree.Commands.ApproveQueue.execute(site, 32, approver, Ecto.UUID.generate())

{:ok, reviewer} = db_insert(:user)

assert {:ok, _} =
         CMS.Passport.stamp_passport(
           %{
             "global" => %{},
             site.slug => %{
               "cms" => %{
                 "doc.queue.approve" => true,
                 "doc.queue.preview" => true,
                 "doc.edit" => true
               }
             }
           },
           reviewer
         )

assert {:ok, %{approval_id: approval_id}} =
         CMS.DocTree.Commands.ApproveQueue.execute(site, 32, reviewer, Ecto.UUID.generate())

assert {:ok, %{queue_revision: 33}} =
         CMS.DocTree.Commands.ReleaseQueue.execute(site, 32, actor, Ecto.UUID.generate())

assert %{snapshot_id: approved_snapshot} =
         Repo.get_by!(CMS.Model.DocsPublishApprovalArticle,
           approval_id: approval_id,
           article_id: conflict_article_id
         )

assert Repo.get!(CMS.Model.ArticlePublic, conflict_article_id).snapshot_id == approved_snapshot
IO.puts("Docs Queue approval and approved Snapshot release verified")
