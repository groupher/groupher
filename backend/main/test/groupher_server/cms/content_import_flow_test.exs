defmodule GroupherServer.CMS.ContentImportFlowTest do
  use GroupherServer.TestMate, async: true

  import Ecto.Query, warn: false
  import GroupherServer.Support.Factory

  alias GroupherServer.Repo
  alias GroupherServer.CMS.Artiment.BodyBag
  alias GroupherServer.CMS.Articles.{Branch, Draft}
  alias GroupherServer.CMS.ContentImport.{Jobs, Staging}
  alias GroupherServer.CMS.ContentImport.Persistence.ImportSourceMapping
  alias GroupherServer.CMS.ContentImport.Persistence.Job
  alias GroupherServer.CMS.ContentImport.Persistence.Job.Body, as: StagedBody
  alias GroupherServer.CMS.ContentImport.Threads.Doc.{Validator, Writer}
  alias GroupherServer.CMS.DocTree
  alias GroupherServer.CMS.DocTree.{Read, Revision}
  alias GroupherServer.CMS.Model.DocTreeNode

  @job_query """
  query ContentImportJob($community: String!, $jobRef: ID!) {
    contentImportJob(community: $community, jobRef: $jobRef) {
      id
      status
      process {
        state
        stage
        progress {
          completed
          total
          unit
        }
        recentBatch {
          ref
          label
          state
        }
        updatedAt
      }
      targetBranch
      sourceInfo {
        repo
        repoUrl
        branch
        commit
        framework
        contentRoot
        configPaths
      }
      counts {
        tabs
        groups
        pages
        links
        assets
      }
    }
  }
  """

  test "stages same-hash BodyBags idempotently and atomically completes Docs and mappings" do
    %{community: community, job: job} = create_job([document("docs/start.md", "/start")])
    body_bag = body_bag("Published body content", "a")

    assert {:ok, %{status: :ready}} =
             Staging.stage(community, job.job_ref, [
               %{external_ref: "docs/start.md", body_bag: body_bag}
             ])

    assert {:ok, %{status: :ready}} =
             Staging.stage(community, job.job_ref, [
               %{external_ref: "docs/start.md", body_bag: body_bag}
             ])

    assert Repo.aggregate(StagedBody, :count) == 1

    assert {:ok, completed} = Writer.apply(community, job.job_ref)
    assert completed.status == :completed
    assert completed.counts.pages == 1
    assert completed.skipped == []
    assert completed.target_branch == Branch.main_slug()
    assert Repo.aggregate(StagedBody, :count) == 0

    assert [mapping] = Repo.all(ImportSourceMapping)
    assert mapping.external_ref == "docs/start.md"
    assert mapping.source_hash =~ "source-md-v1:"
    assert mapping.groupher_hash =~ "doc-sync-v1:"

    assert {:ok, _draft} =
             Draft.read(
               community,
               :doc,
               completed.first_imported_doc_ref,
               completed.target_branch
             )

    assert {:ok, tree} = DocTree.read(community)
    [tab] = tree.tabs
    [group] = tab.groups

    assert Enum.any?(group.pages, &(&1.doc_id == completed.first_imported_doc_ref))

    assert {:ok, replayed} = Writer.apply(community, job.job_ref)
    assert replayed == completed

    assert {:ok, %{status: :completed}} =
             Staging.stage(community, job.job_ref, [
               %{external_ref: "docs/start.md", body_bag: body_bag}
             ])
  end

  test "imports a Doc whenever its canonical plain text is non-empty" do
    %{community: community, job: job} = create_job([document("docs/tiny.md", "/tiny")])

    assert {:ok, %{status: :ready}} =
             Staging.stage(community, job.job_ref, [
               %{external_ref: "docs/tiny.md", body_bag: body_bag("Go", "a")}
             ])

    assert {:ok, completed} = Writer.apply(community, job.job_ref)
    assert completed.status == :completed
    assert completed.counts.pages == 1
  end

  test "preserves recursive source sections as nested TargetTree groups" do
    {:ok, community} = db_insert(:community)

    nested_source_tree = %{
      "navigation" => [
        %{
          "type" => "scope",
          "sourceId" => "guide",
          "title" => "Guide",
          "pages" => [
            %{
              "type" => "section",
              "sourceId" => "guides",
              "title" => "Guides",
              "pages" => [
                %{
                  "type" => "section",
                  "sourceId" => "advanced",
                  "title" => "Advanced",
                  "pages" => [
                    %{
                      "type" => "page",
                      "route" => "/configuration",
                      "sourceId" => "docs/configuration.md",
                      "sourcePath" => "docs/configuration.md",
                      "title" => "Configuration"
                    }
                  ]
                }
              ]
            }
          ]
        }
      ],
      "schemaVersion" => 2,
      "source" => %{"configPaths" => [], "framework" => "vitepress", "root" => "docs"}
    }

    assert {:ok, preview} = Validator.preview(community, source_info(), nested_source_tree)

    assert %{
             "schemaVersion" => 2,
             "tabs" => [
               %{
                 "groups" => [
                   %{
                     "type" => "group",
                     "pages" => [
                       %{
                         "type" => "group",
                         "pages" => [%{"type" => "page"}]
                       }
                     ]
                   }
                 ]
               }
             ]
           } = preview.target_tree

    assert preview.counts.groups == 2
    assert preview.counts.pages == 1
  end

  test "reuses the source mapping and overwrites the existing Draft on repeat import" do
    %{actor: actor, community: community, job: first_job} =
      create_job([document("docs/start.md", "/start")])

    assert {:ok, %{status: :ready}} =
             Staging.stage(community, first_job.job_ref, [
               %{external_ref: "docs/start.md", body_bag: body_bag("First version", "a")}
             ])

    assert {:ok, first_import} = Writer.apply(community, first_job.job_ref)
    first_doc_ref = first_import.first_imported_doc_ref

    # Simulate a tree written by the previous revision-scoped namespace.
    tab = Repo.get_by!(DocTreeNode, community_id: community.id, type: :tab)
    group = Repo.get_by!(DocTreeNode, community_id: community.id, type: :group)
    page = Repo.get_by!(DocTreeNode, community_id: community.id, type: :page)

    Repo.update_all(from(node in DocTreeNode, where: node.id == ^tab.id),
      set: [node_id: "import:tab:legacy"]
    )

    Repo.update_all(from(node in DocTreeNode, where: node.id == ^group.id),
      set: [node_id: "import:group:legacy", parent_node_id: "import:tab:legacy"]
    )

    Repo.update_all(from(node in DocTreeNode, where: node.id == ^page.id),
      set: [node_id: "import:page:legacy", parent_node_id: "import:group:legacy"]
    )

    documents = [document("docs/start.md", "/start", "b")]
    next_source_info = Map.put(source_info(), "commit", String.duplicate("d", 40))

    assert {:ok, preview} =
             Validator.preview(community, next_source_info, source_tree(documents))

    assert get_in(preview.target_tree, [
             "tabs",
             Access.at(0),
             "groups",
             Access.at(0),
             "pages",
             Access.at(0),
             "docId"
           ]) == first_doc_ref

    assert {:ok, second_job} =
             Jobs.create(community, actor, %{
               bad_smells: [],
               dataset_ref: "dset_#{System.unique_integer([:positive])}",
               documents: documents,
               preview_ref: "prv_#{System.unique_integer([:positive])}",
               source_info: next_source_info,
               target_revision: preview.target_revision,
               target_tree: preview.target_tree
             })

    assert {:ok, %{status: :ready}} =
             Staging.stage(community, second_job.job_ref, [
               %{external_ref: "docs/start.md", body_bag: body_bag("Second version", "b")}
             ])

    assert {:ok, second_import} = Writer.apply(community, second_job.job_ref)
    assert second_import.first_imported_doc_ref == first_doc_ref
    assert Repo.aggregate(ImportSourceMapping, :count) == 1
    assert Repo.aggregate(DocTreeNode, :count) == 3

    assert {:ok, draft} = Draft.read(community, :doc, first_doc_ref, Branch.main_slug())
    assert draft.body_hash == String.duplicate("b", 64)

    assert [mapping] = Repo.all(ImportSourceMapping)
    assert mapping.thread_ref == first_doc_ref
    assert mapping.source_revision == next_source_info["commit"]
    assert mapping.source_hash == "source-md-v1:" <> String.duplicate("b", 64)
  end

  test "restores a trashed mapped Doc before overwriting it on repeat import" do
    %{actor: actor, community: community, job: first_job} =
      create_job([document("docs/start.md", "/start")])

    assert {:ok, %{status: :ready}} =
             Staging.stage(community, first_job.job_ref, [
               %{external_ref: "docs/start.md", body_bag: body_bag("First version", "a")}
             ])

    assert {:ok, first_import} = Writer.apply(community, first_job.job_ref)
    first_doc_ref = first_import.first_imported_doc_ref
    page = Repo.get_by!(DocTreeNode, community_id: community.id, type: :page)
    assert {:ok, tree} = DocTree.read(community)

    assert {:ok, _deleted} =
             DocTree.delete_node(community, page.node_id, %{
               actor_id: actor.id,
               base_revision: tree.revision
             })

    assert {:error, {:not_exist, _model}} =
             Draft.read(community, :doc, first_doc_ref, Branch.main_slug())

    assert {:ok, [_trash_item]} = DocTree.trash_items(community)

    documents = [document("docs/start.md", "/start", "b")]
    next_source_info = Map.put(source_info(), "commit", String.duplicate("d", 40))

    assert {:ok, preview} =
             Validator.preview(community, next_source_info, source_tree(documents))

    assert get_in(preview.target_tree, [
             "tabs",
             Access.at(0),
             "groups",
             Access.at(0),
             "pages",
             Access.at(0),
             "docId"
           ]) == first_doc_ref

    assert {:ok, second_job} =
             Jobs.create(community, actor, %{
               bad_smells: [],
               dataset_ref: "dset_#{System.unique_integer([:positive])}",
               documents: documents,
               preview_ref: "prv_#{System.unique_integer([:positive])}",
               source_info: next_source_info,
               target_revision: preview.target_revision,
               target_tree: preview.target_tree
             })

    assert {:ok, %{status: :ready}} =
             Staging.stage(community, second_job.job_ref, [
               %{external_ref: "docs/start.md", body_bag: body_bag("Second version", "b")}
             ])

    assert {:ok, second_import} = Writer.apply(community, second_job.job_ref)
    assert second_import.first_imported_doc_ref == first_doc_ref
    assert {:ok, []} = DocTree.trash_items(community)
    assert Repo.aggregate(ImportSourceMapping, :count) == 1
    assert Repo.aggregate(DocTreeNode, :count) == 3

    assert {:ok, draft} = Draft.read(community, :doc, first_doc_ref, Branch.main_slug())
    assert draft.body_hash == String.duplicate("b", 64)
  end

  test "cancels an unfinished Job idempotently and deletes staged BodyBags" do
    %{community: community, job: job} = create_job([document("docs/start.md", "/start")])

    assert {:ok, %{status: :ready}} =
             Staging.stage(community, job.job_ref, [
               %{external_ref: "docs/start.md", body_bag: body_bag("Staged body", "a")}
             ])

    assert Repo.aggregate(StagedBody, :count) == 1
    assert {:ok, cancelled} = Jobs.cancel(community, job.job_ref)
    assert cancelled.status == :cancelled
    assert Repo.aggregate(StagedBody, :count) == 0

    assert {:ok, replayed} = Jobs.cancel(community, job.job_ref)
    assert replayed.status == :cancelled

    assert {:error, {:content_import_job_not_ready, :cancelled}} =
             Writer.apply(community, job.job_ref)

    assert {:error, {:custom, "ImportJob is not stageable from cancelled"}} =
             Staging.stage(community, job.job_ref, [
               %{external_ref: "docs/start.md", body_bag: body_bag("Late body", "a")}
             ])

    assert {:ok, %{status: :cancelled}} =
             Jobs.fail(community, job.job_ref, "late_failure", "must not revive the Job")
  end

  test "accepts an intentionally empty canonical Docs body beside a non-empty document" do
    documents = [
      document("docs/start.md", "/start"),
      document("docs/empty.md", "/empty", "b")
    ]

    %{community: community, job: job} = create_job(documents)
    invalid_body = %{body_bag("Ignored", "b") | plain_text: "", digest: ""}

    assert {:ok, staged} =
             Staging.stage(community, job.job_ref, [
               %{
                 external_ref: "docs/start.md",
                 body_bag: body_bag("Published body content", "a")
               },
               %{external_ref: "docs/empty.md", body_bag: invalid_body}
             ])

    assert staged.status == :ready

    assert staged.progress["bodies"] == %{
             "failed" => 0,
             "pending" => 0,
             "ready" => 2,
             "skipped" => 0,
             "total" => 2
           }

    assert staged.progress["recentBatch"] == [
             %{
               "label" => "docs/start.md",
               "ref" => "docs/start.md",
               "state" => "completed"
             },
             %{
               "label" => "docs/empty.md",
               "ref" => "docs/empty.md",
               "state" => "completed"
             }
           ]

    assert staged.failed_items == []

    assert {:ok, completed} = Writer.apply(community, job.job_ref)
    assert completed.status == :completed
    assert completed.counts.pages == 2
    assert completed.failed_items == staged.failed_items
    assert Repo.aggregate(ImportSourceMapping, :count) == 2
  end

  test "persists a converter failure without rejecting valid documents in the batch" do
    documents = [
      document("docs/start.md", "/start"),
      document("docs/broken.md", "/broken", "b")
    ]

    %{community: community, job: job} = create_job(documents)

    assert {:ok, staged} =
             Staging.stage(community, job.job_ref, [
               %{
                 external_ref: "docs/start.md",
                 body_bag: body_bag("Published body content", "a")
               },
               %{
                 external_ref: "docs/broken.md",
                 failed: %{
                   code: "unsupported_markdown",
                   message: "Unsupported MDX expression in this document.",
                   stage: "conversion"
                 }
               }
             ])

    assert staged.status == :ready

    assert staged.failed_items == [
             %{
               "code" => "unsupported_markdown",
               "externalRef" => "docs/broken.md",
               "message" => "Unsupported MDX expression in this document.",
               "stage" => "conversion"
             }
           ]

    assert {:ok, completed} = Writer.apply(community, job.job_ref)
    assert completed.status == :completed
    assert completed.counts.pages == 1
    assert completed.failed_items == staged.failed_items
  end

  test "binds a previewRef to the original selected document hashes" do
    %{actor: actor, community: community, job: job} =
      create_job([document("docs/start.md", "/start")])

    record = Repo.get_by!(Job, hash_id: job.job_ref)

    assert {:error, {:custom, "previewRef is already bound to another intent"}} =
             Jobs.create(community, actor, %{
               bad_smells: [],
               dataset_ref: record.dataset_ref,
               documents: [document("docs/start.md", "/start", "b")],
               preview_ref: record.preview_ref,
               source_info: record.source_info,
               target_revision: record.target_revision,
               target_tree: record.target_tree
             })
  end

  test "projects persisted JSON maps through the complete GraphQL Job query" do
    %{actor: actor, community: community, job: job} =
      create_job([document("docs/start.md", "/start")])

    conn = simu_conn(:user, actor, cms: %{community.slug => %{"doc.import" => true}})

    queried =
      gq_query(conn, @job_query, %{community: community.slug, jobRef: job.job_ref})

    assert %{
             "progress" => %{"completed" => 0, "total" => 1, "unit" => "DOCUMENT"},
             "recentBatch" => [],
             "stage" => "PREPARING",
             "state" => "RUNNING",
             "updatedAt" => updated_at
           } = queried["process"]

    assert {:ok, _datetime, 0} = DateTime.from_iso8601(updated_at)

    assert Map.delete(queried, "process") == %{
             "counts" => %{
               "assets" => 0,
               "groups" => 1,
               "links" => 0,
               "pages" => 1,
               "tabs" => 1
             },
             "id" => job.job_ref,
             "sourceInfo" => %{
               "branch" => "main",
               "commit" => String.duplicate("c", 40),
               "configPaths" => [],
               "contentRoot" => "docs",
               "framework" => "vitepress",
               "repo" => "acme/docs",
               "repoUrl" => "https://github.com/acme/docs"
             },
             "status" => "STAGING",
             "targetBranch" => "main"
           }
  end

  test "only content_too_large may skip and skipped pages are removed before apply" do
    documents = [
      document("docs/start.md", "/start"),
      document("docs/large.md", "/large", "b")
    ]

    %{community: community, job: job} = create_job(documents)

    assert {:ok, %{status: :ready}} =
             Staging.stage(community, job.job_ref, [
               %{
                 external_ref: "docs/start.md",
                 body_bag: body_bag("Published body content", "a")
               },
               %{external_ref: "docs/large.md", skipped: %{code: "content_too_large"}}
             ])

    assert {:ok, completed} = Writer.apply(community, job.job_ref)
    assert completed.counts.pages == 1

    assert completed.skipped == [
             %{
               "code" => "content_too_large",
               "externalRef" => "docs/large.md",
               "message" => "Document exceeds the import capacity limit.",
               "stage" => "validation"
             }
           ]

    assert get_in(completed.tree, ["tabs", Access.at(0), "groups", Access.at(0), "pages"])
           |> Enum.map(& &1["sourceId"]) == ["docs/start.md"]

    assert Repo.aggregate(ImportSourceMapping, :count) == 1
  end

  test "an all-skipped Job fails and never enters the writer" do
    %{community: community, job: job} = create_job([document("docs/large.md", "/large")])

    assert {:ok, failed} =
             Staging.stage(community, job.job_ref, [
               %{external_ref: "docs/large.md", skipped: %{code: "content_too_large"}}
             ])

    assert failed.status == :failed
    assert failed.error_code == "no_importable_content"

    assert {:error, {:content_import_job_not_ready, :failed}} =
             Writer.apply(community, job.job_ref)
  end

  test "target revision conflicts roll back without consuming staged bodies" do
    %{community: community, job: job} = create_job([document("docs/start.md", "/start")])

    assert {:ok, %{status: :ready}} =
             Staging.stage(community, job.job_ref, [
               %{external_ref: "docs/start.md", body_bag: body_bag("Published body content", "a")}
             ])

    assert {:ok, branch} = Branch.resolve(community, :doc, Branch.main_slug())
    assert {:ok, state} = Read.ensure_draft_state(community, branch_id: branch.id)
    assert {:ok, _state} = Revision.bump_tree_draft(community, state)

    assert {:error, {:custom, "The Docs target changed after Review"}} =
             Writer.apply(community, job.job_ref)

    assert Repo.get_by!(Job, hash_id: job.job_ref).status == :ready
    assert Repo.aggregate(StagedBody, :count) == 1
    assert Repo.aggregate(ImportSourceMapping, :count) == 0

    assert {:ok, failed} =
             Jobs.fail(
               community,
               job.job_ref,
               "target_revision_conflict",
               "The Docs target changed after Review"
             )

    assert failed.process.state == :failed
    assert failed.process.stage == :applying
  end

  test "rejects batches above the fixed count capacity before touching the Job" do
    {:ok, community} = db_insert(:community)

    items =
      Enum.map(1..5, &%{external_ref: "docs/#{&1}.md", skipped: %{code: "content_too_large"}})

    assert {:error, {:custom, message}} = Staging.stage(community, Ecto.UUID.generate(), items)
    assert message =~ "between 1 and 4"
  end

  test "skips a canonical BodyBag above 5 MiB without staging its payload" do
    %{community: community, job: job} = create_job([document("docs/start.md", "/start")])
    json_text = String.duplicate("x", 2 * 1024 * 1024 - 256)

    oversized = %{
      body_bag("Published body content", "a")
      | json: Jason.encode!([%{"children" => [%{"text" => json_text}], "type" => "p"}]),
        markdown: String.duplicate("m", 2 * 1024 * 1024 - 128),
        html: String.duplicate("h", 1_300_000)
    }

    assert {:ok, _body_bag} = BodyBag.cast(oversized)

    assert {:ok, failed} =
             Staging.stage(community, job.job_ref, [
               %{external_ref: "docs/start.md", body_bag: oversized}
             ])

    assert failed.status == :failed
    assert failed.error_code == "no_importable_content"

    assert failed.skipped == [
             %{
               "code" => "content_too_large",
               "externalRef" => "docs/start.md",
               "message" => "Document exceeds the import capacity limit.",
               "stage" => "validation"
             }
           ]

    assert Repo.aggregate(StagedBody, :count) == 0
    assert Repo.get_by!(Job, hash_id: job.job_ref).status == :failed
  end

  defp create_job(documents) do
    {:ok, actor} = db_insert(:user)
    {:ok, community} = db_insert(:community)
    source_info = source_info()
    source_tree = source_tree(documents)
    assert {:ok, preview} = Validator.preview(community, source_info, source_tree)

    assert {:ok, job} =
             Jobs.create(community, actor, %{
               bad_smells: [],
               dataset_ref: "dset_#{System.unique_integer([:positive])}",
               documents: documents,
               preview_ref: "prv_#{System.unique_integer([:positive])}",
               source_info: source_info,
               target_revision: preview.target_revision,
               target_tree: preview.target_tree
             })

    %{actor: actor, community: community, job: job}
  end

  defp source_info do
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

  defp source_tree(documents) do
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

  defp document(source_ref, route, hash_seed \\ "a") do
    %{
      "content_hash" => "source-md-v1:" <> String.duplicate(hash_seed, 64),
      "route" => route,
      "size_bytes" => 32,
      "source_path" => source_ref,
      "source_ref" => source_ref,
      "title" => source_ref |> Path.basename() |> Path.rootname() |> String.capitalize()
    }
  end

  defp body_bag(text, hash_seed) do
    %{
      body_hash: String.duplicate(hash_seed, 64),
      digest: text,
      html: "<p>#{text}</p>",
      json: Jason.encode!([%{"children" => [%{"text" => text}], "type" => "p"}]),
      markdown: text,
      plain_text: text,
      schema_version: BodyBag.schema_version(),
      toc: []
    }
  end
end
