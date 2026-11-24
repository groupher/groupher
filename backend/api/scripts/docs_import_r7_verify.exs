import ExUnit.Assertions
import Ecto.Query
import GroupherServer.Support.Factory
import GroupherServer.Test.ConnSimulator, only: [simu_conn: 3]
alias GroupherServer.{CMS, Repo}
alias CMS.Import.{DocValidator, Jobs, Staging}
alias CMS.DocTree.Workflows.Import
alias CMS.DocTree.Publish.Queue
alias CMS.Model.{Article, ArticleWorkingCopy, ArticlePublic, DocsTreeNode, DocsQueueArticle}
[[database]] = Repo.query!("SELECT current_database()").rows

unless Mix.env() == :test and System.get_env("DOCS_B0_DISPOSABLE_DATABASE") == database and
         String.starts_with?(database, "groupher_docs_b0_") do
  raise "requires an explicitly named disposable Docs database"
end

defmodule R7ImportFixtures do
  alias GroupherServer.CMS
  alias CMS.Artiment.BodyBag

  def source_info do
    %{
      "branch" => "main",
      "commit" => String.duplicate("c", 40),
      "config_paths" => [],
      "content_root" => "docs",
      "framework" => "vitepress",
      "repo" => "acme/docs",
      "repo_url" => "https://github.com/acme/docs"
    }
  end

  def source_tree(documents) do
    pages =
      Enum.map(documents, fn document ->
        %{
          "type" => "page",
          "route" => document["route"],
          "sourceId" => document["source_ref"],
          "sourcePath" => document["source_path"],
          "title" => document["title"]
        }
      end)

    %{
      "navigation" => [
        %{
          "pages" => pages,
          "type" => "scope",
          "sourceId" => "guide",
          "title" => "Guide"
        }
      ],
      "schemaVersion" => 2,
      "source" => %{"configPaths" => [], "framework" => "vitepress", "root" => "docs"}
    }
  end

  def document(source_ref, route, hash_seed \\ "a") do
    %{
      "content_hash" => "source-md-v1:" <> String.duplicate(hash_seed, 64),
      "route" => route,
      "size_bytes" => 32,
      "source_path" => source_ref,
      "source_ref" => source_ref,
      "title" => source_ref |> Path.basename() |> Path.rootname() |> String.capitalize()
    }
  end

  def body_bag(text, hash_seed) do
    %{
      body_hash: String.duplicate(hash_seed, 64),
      digest: text,
      html: "<p>#{text}</p>",
      json: Jason.encode!([%{"children" => [%{"text" => text}], "type" => "p"}]),
      markdown: text,
      plain_text: text,
      schema_version: BodyBag.schema_version(),
      thumbnail: %{version: 1, blocks: [%{type: "paragraph", text: text}]},
      toc: []
    }
  end
end

alias R7ImportFixtures, as: F
{:ok, actor} = db_insert(:user)
{:ok, site} = db_insert(:community)

_conn =
  simu_conn(:user, actor,
    cms: %{
      site.slug => %{
        "doc.import" => true,
        "doc.queue.write" => true,
        "doc.queue.publish" => true,
        "doc.restore" => true,
        "doc.trash" => true
      }
    }
  )

make_job = fn documents, disposition ->
  {:ok, preview} = DocValidator.preview(site, F.source_info(), F.source_tree(documents))

  assert preview.conflicts == []
  targets = DocValidator.page_targets(preview.target_tree)

  documents =
    Enum.map(documents, fn document ->
      assert Map.fetch!(targets, document["source_ref"])["disposition"] == disposition
      Map.put(document, "overwrite_confirmed", disposition == "overwrite")
    end)

  {:ok, job} =
    Jobs.create(site, actor, %{
      bad_smells: [],
      dataset_ref: Ecto.UUID.generate(),
      preview_ref: Ecto.UUID.generate(),
      documents: documents,
      source_info: F.source_info(),
      target_revision: preview.target_revision,
      target_tree: preview.target_tree
    })

  entries =
    Enum.map(
      documents,
      &%{external_ref: &1["source_ref"], body_bag: F.body_bag("Imported body", "a")}
    )

  {:ok, _} = Staging.stage(site, job.job_ref, entries)
  job
end

documents = [F.document("docs/start.md", "/start"), F.document("docs/next.md", "/next")]
job = make_job.(documents, "create")
assert {:ok, completed} = Import.apply(site, job.job_ref)
assert completed.status == :completed
assert completed.counts.pages == 2
assert {:ok, ^completed} = Import.apply(site, job.job_ref)
assert Repo.aggregate(from(n in DocsTreeNode, where: n.community_id == ^site.id), :count) == 4

{:ok, queue} = Queue.read(site)
queue_members = from(q in DocsQueueArticle, where: q.queue_id == ^queue.id)
refute Repo.exists?(queue_members)

id = completed.first_imported_doc_id
article = Repo.get!(Article, id)
copy = Repo.get_by!(ArticleWorkingCopy, article_id: id, scope_type: :default, scope_id: id)
assert CMS.Articles.Body.document(copy).plain_text == "Imported body"

# Editing D after review must reject apply and preserve its staged body.
stale = make_job.(documents, "overwrite")

{:ok, _} =
  CMS.Articles.save_working_copy(
    article,
    site,
    copy.id,
    %{title: "Changed after review"},
    copy.revision,
    actor,
    Ecto.UUID.generate()
  )

assert {:error, %{reason: :target_revision_conflict}} = Import.apply(site, stale.job_ref)
stale_record = Repo.get_by!(CMS.Import.Model.Job, hash_id: stale.job_ref)
assert stale_record.status == :ready

assert Repo.aggregate(
         from(b in CMS.Import.Model.Job.Body, where: b.job_id == ^stale_record.id),
         :count
       ) == length(documents)

# Reimport uses the same identities and leaves existing Q content unchanged.
fresh = make_job.(documents, "overwrite")
assert {:ok, _} = Import.apply(site, fresh.job_ref)
copy = Repo.get!(ArticleWorkingCopy, copy.id)
{:ok, queue} = Queue.read(site)

{:ok, queued} =
  CMS.DocTree.Commands.Enqueue.execute(
    site,
    queue.queue_revision,
    [%{article_id: id, default_revision: copy.revision}],
    actor,
    Ecto.UUID.generate()
  )

{:ok, _} =
  CMS.DocTree.Commands.ReleaseQueue.execute(
    site,
    queued.queue_revision,
    actor,
    Ecto.UUID.generate()
  )

refute Repo.exists?(from(w in ArticleWorkingCopy, where: w.article_id == ^id))
public = Repo.get!(ArticlePublic, id)
again = make_job.(documents, "overwrite")
assert {:ok, _} = Import.apply(site, again.job_ref)
assert Repo.get_by!(ArticleWorkingCopy, article_id: id, scope_type: :default, scope_id: id)
assert Repo.get!(ArticlePublic, id).snapshot_id == public.snapshot_id

refute Repo.exists?(queue_members)

assert Repo.aggregate(
         from(n in DocsTreeNode, where: n.community_id == ^site.id and n.stage == :draft),
         :count
       ) == 4

IO.puts("R7 Import creation, replay, D revision conflict, stable reimport and optional D passed")

{:ok, other_site} = db_insert(:community)
{:ok, first_preview} = DocValidator.preview(site, F.source_info(), F.source_tree(documents))
{:ok, other_preview} = DocValidator.preview(other_site, F.source_info(), F.source_tree(documents))

first_ids =
  DocValidator.page_targets(first_preview.target_tree)
  |> Map.values()
  |> Enum.map(& &1["docId"])
  |> MapSet.new()

other_ids =
  DocValidator.page_targets(other_preview.target_tree)
  |> Map.values()
  |> Enum.map(& &1["docId"])
  |> MapSet.new()

assert MapSet.disjoint?(first_ids, other_ids)
IO.puts("R7 identical Git sources have independent Article identities in different sites")
