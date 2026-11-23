defmodule GroupherServer.CMS.ImportFlowTest do
  use GroupherServer.TestMate, async: false

  import Ecto.Query, warn: false
  import GroupherServer.Support.Factory

  alias GroupherServer.Activity

  alias GroupherServer.{CMS, Repo}
  alias Activity.Model.DocTreeLog
  alias CMS.Artiment.BodyBag
  alias CMS.Import.{Jobs, Staging}
  alias CMS.Import.Model.{Connection, ImportSourceMapping, Job}
  alias CMS.Import.Model.Job.Body
  alias CMS.Import.DocValidator
  alias CMS.DocTree.Workflows.Import
  alias CMS.DocTree.Publish.Queue
  alias CMS.DocTree.Commands.{Enqueue, ReleaseQueue, DeleteWorkspaceNode, CreateWorkspaceNode}
  alias CMS.Model.{ArticleLifecycle, DocsTreeNode, TrashAction}

  test "an imported canonical Doc enters Mention capture only through its publish Command" do
    %{actor: actor, community: community, job: job} =
      create_job([document("docs/mention.md", "/mention")])

    {target_community, target, _, _} = mock_article(:blog)

    url =
      "#{CMS.ArtimentMentions.Config.site_host()}/#{target_community.slug}/blog/#{article_inner_id(target, target_community)}"

    assert {:ok, _} =
             Staging.stage(community, job.job_ref, [
               %{
                 external_ref: "docs/mention.md",
                 body_bag:
                   body_bag("Imported reference #{url}", "a")
                   |> Map.put(
                     :json,
                     Jason.encode!([
                       %{
                         "type" => "p",
                         "children" => [
                           %{"text" => "Imported reference "},
                           %{"type" => "a", "url" => url, "children" => [%{"text" => "Blog"}]}
                         ]
                       }
                     ])
                   )
               }
             ])

    assert {:ok, imported} = Import.apply(community, job.job_ref)

    refute Repo.get_by(CMS.Model.Mentions.Endpoint,
             type: :doc,
             article_id: imported.first_imported_doc_id
           )

    command_id = Ecto.UUID.generate()
    work = Repo.get_by!(CMS.Model.ArticleWorkingCopy, article_id: imported.first_imported_doc_id)
    assert {:ok, queue} = Queue.read(community)

    assert {:ok, queued} =
             Enqueue.execute(
               community,
               queue.queue_revision,
               [%{article_id: work.article_id, default_revision: work.revision}],
               actor,
               Ecto.UUID.generate()
             )

    assert {:ok, _} = ReleaseQueue.execute(community, queued.queue_revision, actor, command_id)

    endpoint =
      Repo.get_by!(CMS.Model.Mentions.Endpoint,
        type: :doc,
        article_id: imported.first_imported_doc_id
      )

    assert [edge] =
             Repo.all(
               from(edge in CMS.Model.Mentions.Edge,
                 where: edge.source_endpoint_id == ^endpoint.id
               )
             )

    assert Repo.get!(CMS.Model.Mentions.Endpoint, edge.target_endpoint_id).article_id ==
             target.id

    event_count = Repo.aggregate(CMS.Outbox.Event, :count)

    assert {:ok, _} = ReleaseQueue.execute(community, queued.queue_revision, actor, command_id)

    assert Repo.aggregate(CMS.Outbox.Event, :count) == event_count

    assert Repo.get!(CMS.Model.Mentions.Edge, edge.id).edge_key == edge.edge_key

    assert Repo.aggregate(GroupherServer.Messaging.Model.Mention, :count) == 0
  end

  @job_query """
  query ImportJob($community: String!, $jobRef: ID!) {
    importJob(community: $community, jobRef: $jobRef) {
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
    %{actor: actor, community: community, job: job} =
      create_job([document("docs/start.md", "/start")])

    body_bag = body_bag("Published body content", "a")

    assert {:ok, %{status: :ready}} =
             Staging.stage(community, job.job_ref, [
               %{external_ref: "docs/start.md", body_bag: body_bag}
             ])

    assert {:ok, %{status: :ready}} =
             Staging.stage(community, job.job_ref, [
               %{external_ref: "docs/start.md", body_bag: body_bag}
             ])

    assert Repo.aggregate(Body, :count) == 1

    assert {:ok, completed} = Import.apply(community, job.job_ref)
    assert completed.status == :completed
    assert completed.counts.pages == 1
    assert completed.skipped == []
    assert Repo.aggregate(Body, :count) == 0

    assert [mapping] = Repo.all(ImportSourceMapping)
    assert mapping.external_ref == "docs/start.md"
    assert mapping.source_hash =~ "source-md-v1:"
    assert mapping.groupher_hash =~ "doc-sync-v1:"

    assert {:ok, _draft} =
             CMS.docs_editor_read(community, completed.first_imported_doc_id, actor)

    assert {:ok, tree} = CMS.docs_workspace_read(community, actor)
    assert Enum.any?(tree.nodes, &(&1.doc_id == completed.first_imported_doc_id))

    assert {:ok, replayed} = Import.apply(community, job.job_ref)
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

    assert {:ok, completed} = Import.apply(community, job.job_ref)
    assert completed.status == :completed
    assert completed.counts.pages == 1
  end

  test "applies multiple ready Docs with complete source mappings" do
    documents = Enum.map(1..6, &document("docs/page-#{&1}.md", "/page-#{&1}"))
    %{actor: actor, community: community, job: job} = create_job(documents)

    Enum.each(1..6, fn index ->
      assert {:ok, _job} =
               Staging.stage(community, job.job_ref, [
                 %{
                   external_ref: "docs/page-#{index}.md",
                   body_bag: body_bag("Published body content #{index}", "#{index}")
                 }
               ])
    end)

    assert {:ok, completed} = Import.apply(community, job.job_ref)
    assert completed.status == :completed
    assert completed.counts.pages == 6
    assert Repo.aggregate(ImportSourceMapping, :count) == 6

    mappings = Repo.all(from(mapping in ImportSourceMapping, order_by: mapping.external_ref))
    assert Enum.map(mappings, & &1.external_ref) == Enum.map(1..6, &"docs/page-#{&1}.md")
    assert Enum.all?(mappings, &String.starts_with?(&1.groupher_hash, "doc-sync-v1:"))

    assert {:ok, tree} = CMS.docs_workspace_read(community, actor)
    assert length(Enum.filter(tree.nodes, &(&1.type == :page))) == 6
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

    assert {:ok, preview} = DocValidator.preview(community, source_info(), nested_source_tree)

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

    assert {:ok, first_import} = Import.apply(community, first_job.job_ref)
    first_doc_id = first_import.first_imported_doc_id

    assert Repo.get_by(ArticleLifecycle, article_id: first_doc_id)

    documents = [document("docs/start.md", "/start", "b")]
    next_source_info = Map.put(source_info(), "commit", String.duplicate("d", 40))

    assert {:ok, preview} =
             DocValidator.preview(community, next_source_info, source_tree(documents))

    assert get_in(preview.target_tree, [
             "tabs",
             Access.at(0),
             "groups",
             Access.at(0),
             "pages",
             Access.at(0),
             "docId"
           ]) == first_doc_id

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

    assert {:ok, second_import} = Import.apply(community, second_job.job_ref)
    assert second_import.first_imported_doc_id == first_doc_id
    assert source_mapping_count(community) == 1

    assert Repo.aggregate(
             from(node in DocsTreeNode, where: node.community_id == ^community.id),
             :count
           ) == 3

    assert {:ok, %{working_copy: draft}} = CMS.docs_editor_read(community, first_doc_id, actor)
    assert CMS.Articles.Body.document(draft).plain_text == "Second version"

    assert [mapping] = Repo.all(ImportSourceMapping)
    assert mapping.thread_ref == first_doc_id
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

    assert {:ok, first_import} = Import.apply(community, first_job.job_ref)
    first_doc_id = first_import.first_imported_doc_id
    page = Repo.get_by!(DocsTreeNode, community_id: community.id, type: :page)
    assert page.doc_id == first_doc_id

    assert Repo.get_by(ArticleLifecycle, article_id: first_doc_id)
    assert {:ok, queue} = Queue.read(community)

    assert {:ok, _deleted} =
             DeleteWorkspaceNode.execute(
               community,
               queue.tree_lock_version,
               queue.queue_revision,
               page.node_id,
               nil,
               actor,
               Ecto.UUID.generate()
             )

    assert {:error, _} = CMS.docs_editor_read(community, first_doc_id, actor)

    trash_action = Repo.get_by!(TrashAction, community_id: community.id, root_ref: page.node_id)

    documents = [document("docs/start.md", "/start", "b")]
    next_source_info = Map.put(source_info(), "commit", String.duplicate("d", 40))

    assert {:ok, preview} =
             DocValidator.preview(community, next_source_info, source_tree(documents))

    assert get_in(preview.target_tree, [
             "tabs",
             Access.at(0),
             "groups",
             Access.at(0),
             "pages",
             Access.at(0),
             "docId"
           ]) == first_doc_id

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

    assert {:ok, second_import} = Import.apply(community, second_job.job_ref)
    assert second_import.first_imported_doc_id == first_doc_id

    assert Repo.get_by!(DocTreeLog,
             operation_ref: trash_action.hash_id,
             action: :restored,
             source: :worker
           )

    refute Repo.get(TrashAction, trash_action.id)

    assert source_mapping_count(community) == 1

    assert Repo.aggregate(
             from(node in DocsTreeNode, where: node.community_id == ^community.id),
             :count
           ) == 3

    assert {:ok, %{working_copy: draft}} = CMS.docs_editor_read(community, first_doc_id, actor)
    assert CMS.Articles.Body.document(draft).plain_text == "Second version"
  end

  test "cancels an unfinished Job idempotently and deletes staged BodyBags" do
    %{community: community, job: job} = create_job([document("docs/start.md", "/start")])

    assert {:ok, %{status: :ready}} =
             Staging.stage(community, job.job_ref, [
               %{external_ref: "docs/start.md", body_bag: body_bag("Staged body", "a")}
             ])

    assert Repo.aggregate(Body, :count) == 1
    assert {:ok, cancelled} = Jobs.cancel(community, job.job_ref)
    assert cancelled.status == :cancelled
    assert Repo.aggregate(Body, :count) == 0

    assert {:ok, replayed} = Jobs.cancel(community, job.job_ref)
    assert replayed.status == :cancelled

    assert {:error,
            %ErrorCat.Error{
              reason: :import_job_not_ready,
              details: :cancelled
            }} =
             Import.apply(community, job.job_ref)

    assert {:error,
            %ErrorCat.Error{
              reason: :custom,
              details: "ImportJob is not stageable from cancelled"
            }} =
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

    assert {:ok, completed} = Import.apply(community, job.job_ref)
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

    assert {:ok, completed} = Import.apply(community, job.job_ref)
    assert completed.status == :completed
    assert completed.counts.pages == 1
    assert completed.failed_items == staged.failed_items
  end

  test "binds a previewRef to the original selected document hashes" do
    %{actor: actor, community: community, job: job} =
      create_job([document("docs/start.md", "/start")])

    record = Repo.get_by!(Job, hash_id: job.job_ref)

    assert {:error,
            %ErrorCat.Error{
              reason: :custom,
              details: "previewRef is already bound to another intent"
            }} =
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

  test "binds a previewRef to the complete selected document intent" do
    %{actor: actor, community: community, job: job} =
      create_job([document("docs/start.md", "/start")])

    record = Repo.get_by!(Job, hash_id: job.job_ref)
    changed_document = Map.put(document("docs/start.md", "/start"), "title", "Renamed")

    assert {:error,
            %ErrorCat.Error{
              reason: :custom,
              details: "previewRef is already bound to another intent"
            }} =
             Jobs.create(community, actor, %{
               bad_smells: [],
               dataset_ref: record.dataset_ref,
               documents: [changed_document],
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
             "status" => "STAGING"
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

    assert {:ok, completed} = Import.apply(community, job.job_ref)
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

  test "an all-skipped Job fails and never enters the processing stage" do
    %{community: community, job: job} = create_job([document("docs/large.md", "/large")])

    assert {:ok, failed} =
             Staging.stage(community, job.job_ref, [
               %{external_ref: "docs/large.md", skipped: %{code: "content_too_large"}}
             ])

    assert failed.status == :failed
    assert failed.error_code == "no_importable_content"

    assert {:error,
            %ErrorCat.Error{
              reason: :import_job_not_ready,
              details: :failed
            }} =
             Import.apply(community, job.job_ref)
  end

  test "target revision conflicts roll back without consuming staged bodies" do
    %{actor: actor, community: community, job: job} =
      create_job([document("docs/start.md", "/start")])

    assert {:ok, %{status: :ready}} =
             Staging.stage(community, job.job_ref, [
               %{external_ref: "docs/start.md", body_bag: body_bag("Published body content", "a")}
             ])

    assert {:ok, queue} = Queue.read(community)

    assert {:ok, _} =
             CreateWorkspaceNode.execute(
               community,
               queue.tree_lock_version,
               %{type: :tab, title: "Changed target"},
               actor,
               Ecto.UUID.generate()
             )

    assert {:error,
            %ErrorCat.Error{
              reason: :custom,
              details: "The Docs target changed after Review"
            }} =
             Import.apply(community, job.job_ref)

    assert Repo.get_by!(Job, hash_id: job.job_ref).status == :ready
    assert Repo.aggregate(Body, :count) == 1
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

    assert {:error, %ErrorCat.Error{reason: :custom, details: message}} =
             Staging.stage(community, Ecto.UUID.generate(), items)

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

    assert Repo.aggregate(Body, :count) == 0
    assert Repo.get_by!(Job, hash_id: job.job_ref).status == :failed
  end

  test "reads persisted import heading TOC through the editor GraphQL contract" do
    %{actor: actor, community: community, job: job} =
      create_job([document("docs/headings.md", "/headings")])

    toc = [%{id: "import-heading", level: 2, title: "Import heading"}]
    bag = Map.put(body_bag("Import heading body", "a"), :toc, toc)

    assert {:ok, %{status: :ready}} =
             Staging.stage(community, job.job_ref, [
               %{external_ref: "docs/headings.md", body_bag: bag}
             ])

    assert {:ok, completed} = Import.apply(community, job.job_ref)

    query = """
    query ImportedDraftReadback($community: String!, $id: ID!) {
      docsEditor(community: $community, articleId: $id) {
        workingCopy { revision bodyJson bodyMarkdown bodyMarkdownToc }
      }
    }
    """

    assert {:ok, %{data: %{"docsEditor" => %{"workingCopy" => draft}}} = response} =
             Absinthe.run(query, GroupherServerWeb.Schema,
               variables: %{
                 "community" => community.slug,
                 "id" => completed.first_imported_doc_id
               },
               context: %{cur_user: actor}
             )

    refute Map.has_key?(response, :errors)

    assert draft["bodyMarkdownToc"]["items"] == [
             %{"id" => "import-heading", "level" => 2, "title" => "Import heading"}
           ]
  end

  defp create_job(documents) do
    {:ok, actor} = db_insert(:user)
    {:ok, community} = db_insert(:community)

    _conn =
      simu_conn(:user, actor,
        cms: %{
          community.slug => %{
            "doc.import" => true,
            "doc.queue.write" => true,
            "doc.queue.publish" => true,
            "doc.restore" => true,
            "community.article.trash.read" => true
          }
        }
      )

    assert {:ok, passport_scope} = CMS.Passport.load_community_scope(actor, community)
    assert {:ok, true} = CMS.Passport.allowed?(actor, passport_scope, "doc.import")

    source_info = source_info()
    source_tree = source_tree(documents)
    assert {:ok, preview} = DocValidator.preview(community, source_info, source_tree)

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

  defp source_mapping_count(community) do
    connection = Repo.get_by!(Connection, community_id: community.id)

    Repo.aggregate(
      from(mapping in ImportSourceMapping, where: mapping.connection_id == ^connection.id),
      :count
    )
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
      thumbnail: %{version: 1, blocks: [%{type: "paragraph", text: text}]},
      toc: []
    }
  end
end
