# Run only against an explicitly named, fully migrated disposable Docs test database.
import ExUnit.Assertions
import Ecto.Query
import GroupherServer.Support.Factory

alias GroupherServer.{CMS, Repo}
alias CMS.DocTree.Publish.Queue
alias CMS.Model.{Article, ArticleLifecycle, ArticleWorkingCopy, Author}

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
  SaveQueue,
  ResolvePostPublish
}

alias CMS.Articles.Commands.SaveWorkingCopy

alias CMS.Model.{
  ArticleBody,
  ArticlePublic,
  ArticleSnapshot,
  CommunityAdmin,
  DocsPostPublishConflict
}

Repo.insert!(
  CommunityAdmin.changeset(%CommunityAdmin{}, %{
    user_id: actor.id,
    community_id: site.id,
    joined_at: DateTime.utc_now(:second),
    permissions: %{
      "doc.restore" => true,
      "community.article.trash.read" => true,
      "doc.permanent_delete" => true,
      "doc.queue.write" => true,
      "doc.queue.publish" => true,
      "doc.queue.preview" => true
    }
  })
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

# Clean D and its mutable body disappear; history and public projection survive.
{article, work, _page} = create_doc.("Clean")
revision = queue_doc.(article, work)
{release_command, release_result} = release.(revision)
assert Repo.get(ArticleWorkingCopy, work.id) == nil
assert Repo.get(ArticleBody, work.body_id) == nil
assert Repo.get_by!(ArticleLifecycle, article_id: article.id).state == :published
assert Repo.aggregate(from(s in ArticleSnapshot, where: s.article_id == ^article.id), :count) >= 2
assert {:ok, %{nodes: nodes}} = CMS.docs_workspace_read(site, actor)
assert Enum.find(nodes, &(&1.doc_id == article.id)).working_copy_id == nil

assert {:ok, %{working_copy: nil, public_snapshot: snapshot}} =
         CMS.docs_editor_read(site, article.id, actor)

assert snapshot.id == Repo.get!(ArticlePublic, article.id).snapshot_id
assert Repo.get_by(ArticleWorkingCopy, article_id: article.id, scope_type: :default) == nil

assert {:error, _} =
         SaveWorkingCopy.execute(
           article,
           site,
           work.id,
           %{title: "Stale"},
           work.revision,
           actor,
           Ecto.UUID.generate()
         )

# Explicit GraphQL initialization, admission and concurrent duplicate initialization.
query =
  "query($community:String!,$article:ID!){docsEditor(community:$community,articleId:$article){workingCopy{id} publicSnapshot{id bodyJson}}}"

assert {:ok,
        %{
          data: %{
            "docsEditor" => %{"workingCopy" => nil, "publicSnapshot" => %{"id" => public_id}}
          }
        }} =
         Absinthe.run(query, GroupherServerWeb.Schema,
           variables: %{"community" => site.slug, "article" => article.id},
           context: %{cur_user: actor}
         )

{:ok, outsider} = db_insert(:user)

assert {:error, _} =
         BeginEdit.execute(site, article.id, public_id, outsider, Ecto.UUID.generate())

assert {:error, :public_conflict} =
         BeginEdit.execute(site, article.id, Ecto.UUID.generate(), actor, Ecto.UUID.generate())

tasks =
  for _ <- 1..2,
      do:
        Task.async(fn ->
          BeginEdit.execute(site, article.id, public_id, actor, Ecto.UUID.generate())
        end)

[{:ok, first}, {:ok, second}] = Enum.map(tasks, &Task.await(&1, 15_000))
assert first.working_copy_id == second.working_copy_id and first.working_copy_id != work.id

mutation = """
mutation($community:String!,$article:ID!,$snapshot:ID!,$command:ID!) {
  beginDocsEdit(community:$community,articleId:$article,publicSnapshotId:$snapshot,commandId:$command) {
    workingCopyId revision
  }
}
"""

assert {:ok, %{data: %{"beginDocsEdit" => %{"workingCopyId" => graphql_id, "revision" => 1}}}} =
         Absinthe.run(mutation, GroupherServerWeb.Schema,
           variables: %{
             "community" => site.slug,
             "article" => article.id,
             "snapshot" => public_id,
             "command" => Ecto.UUID.generate()
           },
           context: %{cur_user: actor}
         )

assert graphql_id == first.working_copy_id

new_work = Repo.get!(ArticleWorkingCopy, first.working_copy_id)
assert new_work.body_id != work.body_id
assert CMS.Articles.Body.document(new_work) == CMS.Articles.Body.document(snapshot)
assert {:ok, ^release_result} = ReleaseQueue.execute(site, revision, actor, release_command)
assert Repo.get!(ArticleWorkingCopy, new_work.id).revision == 1

assert {:error, _} =
         SaveWorkingCopy.execute(
           article,
           site,
           work.id,
           %{title: "Old session"},
           1,
           actor,
           Ecto.UUID.generate()
         )

# D-only edits and disjoint Q/D edits survive with the same D identity.
revision = queue_doc.(article, new_work)

{:ok, changed_d} =
  SaveWorkingCopy.execute(
    article,
    site,
    new_work.id,
    %{subtitle: "Unpublished subtitle"},
    new_work.revision,
    actor,
    Ecto.UUID.generate()
  )

{:ok, _} =
  SaveQueue.execute(
    site,
    revision,
    article.id,
    1,
    %{title: "Queue title"},
    actor,
    Ecto.UUID.generate()
  )

{:ok, queue} = Queue.read(site)
release.(queue.queue_revision)
retained = Repo.get!(ArticleWorkingCopy, new_work.id)
assert retained.title == "Queue title" and retained.revision == changed_d.revision + 1
assert Repo.get_by!(ArticleLifecycle, article_id: article.id).state == :published

assert {:ok, %{subtitle: "Unpublished subtitle"}} =
         CMS.DocTree.Publish.ContentState.load(retained)

# Publishing the retained edit cleans D; replay of BeginEdit cannot resurrect it.
begin_command = Ecto.UUID.generate()
public = Repo.get!(ArticlePublic, article.id)
{:ok, begun} = BeginEdit.execute(site, article.id, public.snapshot_id, actor, begin_command)
revision = queue_doc.(article, retained)
release.(revision)
assert Repo.get(ArticleWorkingCopy, retained.id) == nil

assert {:ok, ^begun} =
         BeginEdit.execute(site, article.id, public.snapshot_id, actor, begin_command)

assert Repo.get_by(ArticleWorkingCopy, article_id: article.id, scope_type: :default) == nil

# Conflicting D remains unchanged; resolving to Public removes it and replays safely.
work = begin_edit.(article)
revision = queue_doc.(article, work)

{:ok, changed} =
  SaveWorkingCopy.execute(
    article,
    site,
    work.id,
    %{title: "Default choice"},
    work.revision,
    actor,
    Ecto.UUID.generate()
  )

{:ok, _} =
  SaveQueue.execute(
    site,
    revision,
    article.id,
    1,
    %{title: "Public choice"},
    actor,
    Ecto.UUID.generate()
  )

{:ok, queue} = Queue.read(site)
release.(queue.queue_revision)
assert Repo.get!(ArticleWorkingCopy, work.id).revision == changed.revision
conflict = Repo.get_by!(DocsPostPublishConflict, article_id: article.id)

assert {:error, _} =
         Enqueue.execute(
           site,
           queue.queue_revision + 1,
           [%{article_id: article.id, default_revision: changed.revision}],
           actor,
           Ecto.UUID.generate()
         )

resolve_command = Ecto.UUID.generate()

assert {:error, _} =
         ResolvePostPublish.execute(
           site,
           article.id,
           Ecto.UUID.generate(),
           changed.revision,
           conflict.published_snapshot_id,
           %{title: :source},
           actor,
           Ecto.UUID.generate()
         )

assert Repo.get!(ArticleWorkingCopy, work.id).revision == changed.revision
assert Repo.get_by!(DocsPostPublishConflict, article_id: article.id)

assert {:error, {:default_revision_conflict, _, _}} =
         ResolvePostPublish.execute(
           site,
           article.id,
           work.id,
           changed.revision - 1,
           conflict.published_snapshot_id,
           %{title: :source},
           actor,
           Ecto.UUID.generate()
         )

assert {:ok, %{working_copy_revision: nil} = resolved} =
         ResolvePostPublish.execute(
           site,
           article.id,
           work.id,
           changed.revision,
           conflict.published_snapshot_id,
           %{title: :source},
           actor,
           resolve_command
         )

assert Repo.get(ArticleWorkingCopy, work.id) == nil
assert Repo.get_by(DocsPostPublishConflict, article_id: article.id) == nil
later = begin_edit.(article)

assert {:ok, ^resolved} =
         ResolvePostPublish.execute(
           site,
           article.id,
           work.id,
           changed.revision,
           conflict.published_snapshot_id,
           %{title: :source},
           actor,
           resolve_command
         )

assert Repo.get!(ArticleWorkingCopy, later.id)

IO.puts(
  "R5 clean deletion, explicit initialization, retention, conflict and Receipt checks passed"
)

# A queue-only change has no unpublished D; an injected later failure rolls deletion back.
{clean_article, clean_work, clean_page} = create_doc.("Q-only")
revision = queue_doc.(clean_article, clean_work)

{:ok, _} =
  SaveQueue.execute(
    site,
    revision,
    clean_article.id,
    1,
    %{title: "Published Q-only"},
    actor,
    Ecto.UUID.generate()
  )

{:ok, queue} = Queue.read(site)

assert {:error, :injected} =
         Repo.transaction(fn ->
           assert {:ok, _} =
                    ReleaseQueue.execute(site, queue.queue_revision, actor, Ecto.UUID.generate())

           assert Repo.get(ArticleWorkingCopy, clean_work.id) == nil
           Repo.rollback(:injected)
         end)

assert Repo.get!(ArticleWorkingCopy, clean_work.id)
assert Repo.get!(ArticleBody, clean_work.body_id)
assert Repo.get(ArticlePublic, clean_article.id) == nil
assert Repo.get_by!(CMS.Model.DocsQueueArticle, article_id: clean_article.id)
release.(queue.queue_revision)
assert Repo.get(ArticleWorkingCopy, clean_work.id) == nil

# Trash does not create D. A deletion Release creates a recovery D before revoking Public.
alias CMS.DocTree.Commands.{DeleteWorkspaceNode, RestoreWorkspaceNode, PurgeWorkspaceTrash}
{:ok, queue} = Queue.read(site)

{:ok, deleted} =
  DeleteWorkspaceNode.execute(
    site,
    queue.tree_lock_version,
    queue.queue_revision,
    clean_page.node_id,
    nil,
    actor,
    Ecto.UUID.generate()
  )

assert Repo.get_by!(ArticleLifecycle, article_id: clean_article.id).state == :published

assert {:error, _} =
         BeginEdit.execute(
           site,
           clean_article.id,
           Repo.get!(ArticlePublic, clean_article.id).snapshot_id,
           actor,
           Ecto.UUID.generate()
         )

{:ok, trash_item} =
  CMS.Articles.CommunityTrashQuery.get(site, actor, :doc, deleted.trash_action_id)

{:ok, _} =
  RestoreWorkspaceNode.execute(
    site,
    deleted.tree_revision,
    deleted.queue_revision,
    deleted.trash_action_id,
    trash_item.record_revision,
    :restore_original,
    nil,
    actor,
    Ecto.UUID.generate()
  )

assert Repo.get_by!(ArticleLifecycle, article_id: clean_article.id).state == :published
{:ok, queue} = Queue.read(site)

{:ok, deleted} =
  DeleteWorkspaceNode.execute(
    site,
    queue.tree_lock_version,
    queue.queue_revision,
    clean_page.node_id,
    nil,
    actor,
    Ecto.UUID.generate()
  )

old_public = Repo.get!(ArticlePublic, clean_article.id)
release.(deleted.queue_revision)
assert Repo.get(ArticlePublic, clean_article.id) == nil

recovery =
  Repo.get_by!(ArticleWorkingCopy,
    article_id: clean_article.id,
    scope_type: :default,
    scope_id: clean_article.id
  )

assert CMS.Articles.Body.document(recovery) ==
         CMS.Articles.Body.document(Repo.get!(ArticleSnapshot, old_public.snapshot_id))

{:ok, queue} = Queue.read(site)

{:ok, trash_item} =
  CMS.Articles.CommunityTrashQuery.get(site, actor, :doc, deleted.trash_action_id)

{:ok, _} =
  RestoreWorkspaceNode.execute(
    site,
    queue.tree_lock_version,
    queue.queue_revision,
    deleted.trash_action_id,
    trash_item.record_revision,
    :restore_original,
    nil,
    actor,
    Ecto.UUID.generate()
  )

assert Repo.get_by(CMS.Model.DocsQueueArticle, article_id: clean_article.id) == nil
assert Repo.get!(ArticleWorkingCopy, recovery.id)
revision = queue_doc.(clean_article, recovery)
release.(revision)
assert Repo.get(ArticleWorkingCopy, recovery.id) == nil
{:ok, queue} = Queue.read(site)

{:ok, deleted} =
  DeleteWorkspaceNode.execute(
    site,
    queue.tree_lock_version,
    queue.queue_revision,
    clean_page.node_id,
    nil,
    actor,
    Ecto.UUID.generate()
  )

release.(deleted.queue_revision)
{:ok, queue} = Queue.read(site)

assert {:ok, _} =
         PurgeWorkspaceTrash.execute(
           site,
           queue.queue_revision,
           deleted.trash_action_id,
           actor,
           Ecto.UUID.generate()
         )

assert Repo.get_by!(ArticleLifecycle, article_id: clean_article.id).state == :deleted
assert Repo.get_by(ArticleWorkingCopy, article_id: clean_article.id) == nil
assert Repo.get!(ArticleSnapshot, old_public.snapshot_id)
IO.puts("R5 rollback and Trash recovery lifecycle checks passed")

# Two real DB connections: save wins the Article lock, so publishing retains the new edit.
{race_article, race_work, _} = create_doc.("Concurrent")
revision = queue_doc.(race_article, race_work)

await_blocked = fn pid ->
  assert Enum.reduce_while(1..200, false, fn _, _ ->
           [[blocked]] = Repo.query!("SELECT cardinality(pg_blocking_pids($1)) > 0", [pid]).rows

           if blocked,
             do: {:halt, true},
             else:
               (
                 Process.sleep(10)
                 {:cont, false}
               )
         end)
end

parent = self()

save_task =
  Task.async(fn ->
    Repo.transaction(fn ->
      {:ok, saved} =
        SaveWorkingCopy.execute(
          race_article,
          site,
          race_work.id,
          %{title: "Saved first"},
          race_work.revision,
          actor,
          Ecto.UUID.generate()
        )

      send(parent, {:save_held, self()})

      receive do
        :commit -> saved
      after
        10_000 -> raise "commit barrier timeout"
      end
    end)
  end)

assert_receive {:save_held, saver}, 10_000

publish_task =
  Task.async(fn ->
    Repo.transact(fn ->
      [[pid]] = Repo.query!("SELECT pg_backend_pid()").rows
      send(parent, {:publish_started, pid})
      ReleaseQueue.execute(site, revision, actor, Ecto.UUID.generate())
    end)
  end)

assert_receive {:publish_started, publish_pid}, 10_000
await_blocked.(publish_pid)
send(saver, :commit)
assert {:ok, _} = Task.await(save_task, 15_000)
assert {:ok, _} = Task.await(publish_task, 15_000)
assert Repo.get!(ArticleWorkingCopy, race_work.id).title == "Saved first"

# Publishing wins, deleting D in the held transaction; an old-ID save fails after commit.
race_work = Repo.get!(ArticleWorkingCopy, race_work.id)
revision = queue_doc.(race_article, race_work)

publish_task =
  Task.async(fn ->
    Repo.transaction(fn ->
      {:ok, result} = ReleaseQueue.execute(site, revision, actor, Ecto.UUID.generate())
      send(parent, {:publish_held, self()})

      receive do
        :commit -> result
      after
        10_000 -> raise "commit barrier timeout"
      end
    end)
  end)

assert_receive {:publish_held, publisher}, 10_000

save_task =
  Task.async(fn ->
    Repo.transact(fn ->
      [[pid]] = Repo.query!("SELECT pg_backend_pid()").rows
      send(parent, {:save_started, pid})

      SaveWorkingCopy.execute(
        race_article,
        site,
        race_work.id,
        %{title: "Stale after release"},
        race_work.revision,
        actor,
        Ecto.UUID.generate()
      )
    end)
  end)

assert_receive {:save_started, save_pid}, 10_000
await_blocked.(save_pid)
send(publisher, :commit)
assert {:ok, _} = Task.await(publish_task, 15_000)
assert {:error, _} = Task.await(save_task, 15_000)
assert Repo.get_by(ArticleWorkingCopy, article_id: race_article.id, scope_type: :default) == nil
IO.puts("R5 save/publication ordering checks passed")
