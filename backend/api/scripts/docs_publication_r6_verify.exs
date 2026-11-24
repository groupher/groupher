# Run only against an explicitly named, fully migrated disposable Docs test database.
import ExUnit.Assertions
import Ecto.Query
import GroupherServer.Support.Factory

alias GroupherServer.{CMS, Repo}
alias CMS.DocTree.Publish.Queue
alias CMS.Model.{Article, ArticleWorkingCopy, Author, DocsLifecycle}

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

alias CMS.DocTree.Commands.{
  CreateWorkspaceNode,
  Enqueue,
  ReleaseQueue,
  BeginEdit,
  SaveQueue
}

alias CMS.Articles.Commands.SaveWorkingCopy
alias CMS.Model.{ArticlePublic, ArticleSnapshot}

{:ok, _} =
  CMS.Passport.stamp_passport(
    %{
      "global" => %{},
      site.slug => %{
        "cms" => %{
          "doc.restore" => true,
          "doc.trash" => true,
          "doc.permanent_delete" => true,
          "doc.queue.write" => true,
          "doc.queue.publish" => true,
          "doc.queue.preview" => true,
          "doc.history.read" => true,
          "doc.queue.configure" => true,
          "doc.queue.approve" => true
        }
      }
    },
    actor
  )

{:ok, %{node_id: tab}} =
  CreateWorkspaceNode.execute(site, 0, %{type: :tab, title: "Tab"}, actor, Ecto.UUID.generate())

{:ok, %{node_id: group}} =
  CreateWorkspaceNode.execute(
    site,
    1,
    %{type: :group, title: "Group", parent_node_id: tab},
    actor,
    Ecto.UUID.generate()
  )

create_doc = fn title ->
  {:ok, queue} = Queue.read(site)

  {:ok, page} =
    CreateWorkspaceNode.execute(
      site,
      queue.tree_lock_version,
      %{type: :page, title: title, parent_node_id: group},
      actor,
      Ecto.UUID.generate()
    )

  article = Repo.get!(Article, page.article_id)

  {:ok, work} =
    SaveWorkingCopy.execute(
      article,
      site,
      page.working_copy_id,
      %{body_bag: body},
      1,
      actor,
      Ecto.UUID.generate()
    )

  {article, work, page}
end

queue_doc = fn article, work ->
  {:ok, queue} = Queue.read(site)

  {:ok, result} =
    Enqueue.execute(
      site,
      queue.queue_revision,
      [%{article_id: article.id, default_revision: work.revision}],
      actor,
      Ecto.UUID.generate()
    )

  result.queue_revision
end

release = fn revision ->
  command = Ecto.UUID.generate()
  {:ok, result} = ReleaseQueue.execute(site, revision, actor, command)
  {command, result}
end

begin_edit = fn article ->
  public = Repo.get!(ArticlePublic, article.id)

  {:ok, result} =
    BeginEdit.execute(site, article.id, public.snapshot_id, actor, Ecto.UUID.generate())

  Repo.get!(ArticleWorkingCopy, result.working_copy_id)
end

alias CMS.DocTree.Publication.{Query, Notifications, Presentation}
alias CMS.DocTree.Commands.{ConfigureQueue, ApproveQueue}
alias CMS.Model.{DocsPublicationNotification, DocsTreeNode, DocCoverCard}

{article, work, page} = create_doc.("Preview queued")
{unqueued, _, _} = create_doc.("Not in queue")
_revision = queue_doc.(article, work)
count = Repo.aggregate(ArticleWorkingCopy, :count)
assert {:ok, initial} = Query.preview(site, actor, article_id: article.id)
assert initial.page.title == "Preview queued"
assert initial.page.body.json == json
assert Enum.any?(initial.nodes, &(&1.doc_id == article.id))
refute Enum.any?(initial.nodes, &(&1.doc_id == unqueued.id))
assert Repo.aggregate(ArticleWorkingCopy, :count) == count
{:ok, outsider} = db_insert(:user)
assert {:error, _} = Query.preview(site, outsider, [])
assert {:error, _} = Query.releases(site, outsider, [])

versions = Jason.decode!(Jason.encode!(initial.versions))
assert {:ok, ^initial} = Query.preview(site, actor, versions: versions, article_id: article.id)
{:ok, queue} = Queue.read(site)
copy = Repo.get_by!(ArticleWorkingCopy, article_id: article.id, scope_kind: :workspace)

assert {:ok, _} =
         SaveQueue.execute(
           site,
           queue.queue_revision,
           article.id,
           copy.revision,
           %{title: "Queued changed"},
           actor,
           Ecto.UUID.generate()
         )

assert {:error, :docs_preview_changed} =
         Query.preview(site, actor, versions: versions, article_id: article.id)

assert {:ok, diff} = Query.diff(site, actor, baseline: :public, article_id: article.id)
assert diff.before_content == nil
assert diff.after_content.title == "Queued changed"
{:ok, queue} = Queue.read(site)
{_, first_release} = release.(queue.queue_revision)
assert {:ok, public_preview} = Query.preview(site, actor, article_id: article.id)
assert public_preview.page.title == "Queued changed"
work = begin_edit.(article)

{:ok, updated} =
  SaveWorkingCopy.execute(
    article,
    site,
    work.id,
    %{title: "D only"},
    work.revision,
    actor,
    Ecto.UUID.generate()
  )

assert {:ok, same_public} = Query.preview(site, actor, article_id: article.id)
assert same_public.page.title == "Queued changed"
revision = queue_doc.(article, updated)

configure = """
mutation($community:String!,$revision:Int!,$required:Boolean!,$command:ID!) {
 configureDocsQueue(community:$community,approvalPolicyRevision:$revision,approvalRequired:$required,allowSelfApproval:false,commandId:$command)
}
"""

vars = %{
  "community" => site.slug,
  "revision" => 0,
  "required" => true,
  "command" => Ecto.UUID.generate()
}

assert {:ok, %{data: %{"configureDocsQueue" => %{approval_policy_revision: 1}}}} =
         Absinthe.run(configure, GroupherServerWeb.Schema,
           variables: vars,
           context: %{cur_user: actor}
         )

assert {:ok, %{data: %{"configureDocsQueue" => %{approval_policy_revision: 1}}}} =
         Absinthe.run(configure, GroupherServerWeb.Schema,
           variables: vars,
           context: %{cur_user: actor}
         )

assert {:error, :docs_self_approval_forbidden} =
         ApproveQueue.execute(site, revision, actor, Ecto.UUID.generate())

{:ok, approver} = db_insert(:user)

{:ok, _} =
  CMS.Passport.stamp_passport(
    %{
      "global" => %{},
      site.slug => %{
        "cms" => %{
          "doc.queue.preview" => true,
          "doc.queue.approve" => true,
          "doc.history.read" => true
        }
      }
    },
    approver
  )

assert {:ok, _} = Query.preview(site, approver, article_id: article.id)
assert {:ok, approval} = ApproveQueue.execute(site, revision, approver, Ecto.UUID.generate())
assert {:ok, comparison} = Query.diff(site, approver, baseline: :approval, article_id: article.id)
assert comparison.baseline.id == approval.approval_id
assert comparison.before_content.title == "D only"
assert comparison.after_content.title == "D only"
copy = Repo.get_by!(ArticleWorkingCopy, article_id: article.id, scope_kind: :workspace)

assert {:ok, _} =
         SaveQueue.execute(
           site,
           revision,
           article.id,
           copy.revision,
           %{title: "After approval"},
           actor,
           Ecto.UUID.generate()
         )

assert {:ok, diff} = Query.diff(site, approver, baseline: :approval, article_id: article.id)
assert diff.before_content.title == "D only"
assert diff.after_content.title == "After approval"
assert {:ok, public_diff} = Query.diff(site, approver, baseline: :public, article_id: article.id)
assert public_diff.before_content.title == "Queued changed"

# Outbox delivery is idempotent and occurs outside the approval transaction.
events =
  Repo.all(
    from(e in CMS.Outbox.Event,
      where: e.event == "docs.approval_status" and e.resource_id == ^queue.id
    )
  )

assert Enum.any?(events, &(&1.data["status"] == "approved"))
assert Enum.any?(events, &(&1.data["status"] == "pending"))

for event <- events do
  assert {:ok, :delivered} = Notifications.deliver(event)
  assert {:ok, :delivered} = Notifications.deliver(event)
end

assert Repo.aggregate(
         from(n in DocsPublicationNotification, where: n.community_id == ^site.id),
         :count
       ) == length(events) * 2

for event <- events do
  assert {:ok, :pass} =
           CMS.deliver_outbox(:docs, %Oban.Job{
             args: %{"event_id" => event.id},
             attempt: 1,
             max_attempts: 8
           })

  assert {:ok, :pass} =
           CMS.deliver_outbox(:docs, %Oban.Job{
             args: %{"event_id" => event.id},
             attempt: 2,
             max_attempts: 8
           })
end

event = hd(events)

assert {:ok, :delivered} =
         Notifications.deliver(%{event | data: Map.put(event.data, "recipients", [outsider.id])})

refute Repo.exists?(
         from(n in DocsPublicationNotification,
           where: n.community_id == ^site.id and n.user_id == ^outsider.id
         )
       )

assert {:ok, %{items: notices}} = Notifications.read(site, actor)
assert length(notices) == length(events)
assert {:error, _} = Notifications.read(site, outsider)

assert {:ok, %{items: [summary]}} = Query.releases(site, actor, [])
assert summary.id == first_release.release_id
assert {:ok, old} = Query.release(site, actor, summary.id, article.id)
assert old.page.title == "Queued changed"
assert {:ok, history} = Query.snapshots(site, actor, article.id, [])
assert length(history.items) >= 3
assert {:error, _} = Query.snapshots(site, outsider, article.id, [])
{:ok, other_site} = db_insert(:community)
assert {:error, _} = Query.release(other_site, actor, summary.id, article.id)
assert {:ok, _} = ConfigureQueue.execute(site, 1, false, false, actor, Ecto.UUID.generate())
{:ok, queue} = Queue.read(site)
{_, second_release} = release.(queue.queue_revision)
assert {:ok, %{items: [latest], next_id: next}} = Query.releases(site, actor, limit: 1)
assert latest.id == second_release.release_id and next == latest.id
assert {:ok, %{items: [older]}} = Query.releases(site, actor, before_id: next)
assert older.id == first_release.release_id

# Cover and settings share the preview's presentation revision.
assert {:ok, before_cover} = Query.preview(site, actor, [])
public_group = Repo.get_by!(DocsTreeNode, community_id: site.id, node_id: group, stage: :public)

assert {:ok, _} =
         Repo.transact(fn ->
           Presentation.write(site, fn ->
             %DocCoverCard{}
             |> DocCoverCard.changeset(%{
               community_id: site.id,
               group_node_id: public_group.id,
               index: 0,
               appearance: %{}
             })
             |> Repo.insert()
           end)
         end)

assert {:error, :docs_preview_changed} =
         Query.preview(site, actor, versions: Jason.decode!(Jason.encode!(before_cover.versions)))

assert {:ok, after_cover} = Query.preview(site, actor, [])
assert length(after_cover.presentation.cards) == 1
assert after_cover.versions.queue_revision == before_cover.versions.queue_revision

# No cached authorization: a fresh Review hold is respected even with unchanged versions.
{:ok, review_versions} = Query.preview(site, approver, [])

block =
  %CMS.Model.ArticleReviewBlock{
    article_id: article.id,
    community_id: site.id,
    type: :manual_hold,
    source: :human,
    source_ref: "r6-review",
    applied_at: DateTime.utc_now() |> DateTime.truncate(:second)
  }
  |> Repo.insert!()

assert {:error, _} =
         Query.preview(site, approver,
           article_id: article.id,
           versions: Jason.decode!(Jason.encode!(review_versions.versions))
         )

assert {:ok, _} = Query.preview(site, actor, article_id: article.id)
assert {:error, _} = Query.snapshots(site, approver, article.id, [])
Repo.delete!(block)
# Config-only does not imply preview/history; history-only does not imply editing.
{:ok, config_actor} = db_insert(:user)

{:ok, _} =
  CMS.Passport.stamp_passport(
    %{"global" => %{}, site.slug => %{"cms" => %{"doc.queue.configure" => true}}},
    config_actor
  )

assert {:ok, _} = Query.policy(site, config_actor)
assert {:error, _} = Query.preview(site, config_actor, [])
assert {:error, _} = Query.releases(site, config_actor, [])
# SQL mode itself prevents an accidental writer from being added to preview.
assert_raise Postgrex.Error, fn ->
  Query.snapshot(site, actor, :docs_queue_preview, fn _ ->
    Repo.query!(
      "UPDATE cms.docs_publish_queues SET queue_revision = queue_revision WHERE community_id = $1",
      [site.id]
    )

    {:ok, :unexpected}
  end)
end

# Snapshot restore forks into D only; replay and stale identities cannot overwrite a newer edit.
alias CMS.DocTree.Commands.RestoreSnapshot
public = Repo.get!(ArticlePublic, article.id)
source = old.page.id
lifecycle = Repo.get_by!(DocsLifecycle, article_id: article.id, community_id: site.id)

existing =
  if lifecycle.default_working_copy_id,
    do: Repo.get!(ArticleWorkingCopy, lifecycle.default_working_copy_id)

command = Ecto.UUID.generate()

assert {:ok, restored} =
         RestoreSnapshot.execute(
           site,
           article.id,
           source,
           existing && existing.id,
           existing && existing.revision,
           actor,
           command
         )

assert Repo.get!(ArticleWorkingCopy, restored.working_copy_id).title == "Queued changed"
assert Repo.get!(ArticlePublic, article.id) == public
assert Repo.get!(ArticleSnapshot, source).title == "Queued changed"

assert {:ok, ^restored} =
         RestoreSnapshot.execute(
           site,
           article.id,
           source,
           existing && existing.id,
           existing && existing.revision,
           actor,
           command
         )

assert {:error, _} =
         RestoreSnapshot.execute(site, article.id, source, nil, nil, actor, Ecto.UUID.generate())

assert {:error, _} =
         RestoreSnapshot.execute(
           site,
           article.id,
           source,
           restored.working_copy_id,
           restored.revision,
           approver,
           Ecto.UUID.generate()
         )

assert {:ok, restored_again} =
         RestoreSnapshot.execute(
           site,
           article.id,
           source,
           restored.working_copy_id,
           restored.revision,
           actor,
           Ecto.UUID.generate()
         )

assert restored_again.working_copy_id == restored.working_copy_id
assert restored_again.revision == restored.revision + 1
assert {:error, _} = Query.snapshots(site, actor, article.id, snapshot_id: "invalid")

assert {:error, _} =
         Query.snapshots(site, actor, article.id, cursor: %{"captured_at" => 1, "id" => "bad"})

# History ownership survives removal of workspace binding; preview access does not.
{:ok, queue} = Queue.read(site)

{:ok, deleted} =
  CMS.DocTree.Commands.DeleteWorkspaceNode.execute(
    site,
    queue.tree_lock_version,
    queue.queue_revision,
    page.node_id,
    nil,
    actor,
    Ecto.UUID.generate()
  )

assert {:ok, deleted_diff} = Query.diff(site, actor, baseline: :public, article_id: article.id)
assert deleted_diff.before_content != nil
assert deleted_diff.after_content == nil
release.(deleted.queue_revision)
{:ok, queue} = Queue.read(site)

assert {:ok, _} =
         CMS.DocTree.Commands.PurgeWorkspaceTrash.execute(
           site,
           queue.queue_revision,
           deleted.trash_action_id,
           actor,
           Ecto.UUID.generate()
         )

assert Repo.get_by(DocsLifecycle, article_id: article.id) == nil
# Legacy binding deletion guard remains R7 scope. History authorization is
# constructed from DocsHistoryOwner and remains readable after lifecycle purge.
assert {:ok, retained} = Query.snapshots(site, actor, article.id, snapshot_id: source)
assert retained.page.title == "Queued changed"
assert {:ok, historical} = Query.release(site, actor, first_release.release_id, article.id)
assert historical.page.title == "Queued changed"
assert {:error, _} = Query.preview(site, actor, article_id: article.id)

IO.puts("R6 preview, approval diff/configuration, notifications, history and restore passed")
