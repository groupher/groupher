# Run only against an explicitly named, fully migrated disposable Docs test database.
import ExUnit.Assertions
import Ecto.Query
import GroupherServer.Support.Factory

alias GroupherServer.{CMS, Repo}
alias CMS.DocTree.Publish.Queue
alias CMS.Model.{Article, ArticleWorkingCopy, Author}

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
  BeginEdit
}

alias CMS.Articles.Commands.SaveWorkingCopy
alias CMS.Model.ArticlePublic

{:ok, _} =
  CMS.Passport.stamp_passport(
    %{
      "global" => %{},
      site.slug => %{
        "cms" => %{
          "doc.restore" => true,
          "community.article.trash.read" => true,
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

_begin_edit = fn article ->
  public = Repo.get!(ArticlePublic, article.id)

  {:ok, result} =
    BeginEdit.execute(site, article.id, public.snapshot_id, actor, Ecto.UUID.generate())

  Repo.get!(ArticleWorkingCopy, result.working_copy_id)
end

alias CMS.DocTree.Commands.DuplicateWorkspaceNode
{article, work, page} = create_doc.("Original")
{:ok, queue} = Queue.read(site)
command = Ecto.UUID.generate()

assert {:ok, duplicate} =
         DuplicateWorkspaceNode.execute(
           site,
           queue.tree_lock_version,
           page.node_id,
           actor,
           command
         )

assert duplicate.article_id != article.id
copy = Repo.get!(ArticleWorkingCopy, duplicate.working_copy_id)
assert copy.body_id != work.body_id
assert CMS.Articles.Body.document(copy) == CMS.Articles.Body.document(work)
assert copy.title == "Original copy"

assert {:ok, ^duplicate} =
         DuplicateWorkspaceNode.execute(
           site,
           queue.tree_lock_version,
           page.node_id,
           actor,
           command
         )

{:ok, outsider} = db_insert(:user)

assert {:error, _} =
         DuplicateWorkspaceNode.execute(
           site,
           duplicate.tree_revision,
           page.node_id,
           outsider,
           Ecto.UUID.generate()
         )

assert {:error, _} =
         DuplicateWorkspaceNode.execute(
           site,
           queue.tree_lock_version,
           page.node_id,
           actor,
           Ecto.UUID.generate()
         )

queue_doc.(article, work) |> release.()
refute Repo.exists?(from(w in ArticleWorkingCopy, where: w.article_id == ^article.id))
{:ok, queue} = Queue.read(site)

assert {:ok, duplicate2} =
         DuplicateWorkspaceNode.execute(
           site,
           queue.tree_lock_version,
           page.node_id,
           actor,
           Ecto.UUID.generate()
         )

copy2 = Repo.get!(ArticleWorkingCopy, duplicate2.working_copy_id)
assert copy2.title == "Original copy 2"
assert CMS.Articles.Body.document(copy2) == CMS.Articles.Body.document(copy)
refute Repo.exists?(from(w in ArticleWorkingCopy, where: w.article_id == ^article.id))
assert Repo.get!(ArticlePublic, article.id)

IO.puts(
  "R7 duplicate independent body, Receipt replay, revision/permission rejection and Public source without creating D passed"
)
