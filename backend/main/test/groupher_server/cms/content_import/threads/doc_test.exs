defmodule GroupherServer.CMS.ContentImport.Threads.DocTest do
  use GroupherServer.TestMate, async: false

  import GroupherServer.CMS.ContentImport.FrameworkCase

  alias GroupherServer.CMS.ContentImport.{ApplyResult, Entry, Mapping, Plan, Preview, Snapshot}
  alias GroupherServer.CMS.ContentImport.Platforms.Archive.Zip
  alias GroupherServer.CMS.ContentImport.Platforms.GitHub.Repository
  alias GroupherServer.CMS.ContentImport.Plan.{Asset, Item}
  alias GroupherServer.CMS.ContentImport.Preview.Item, as: PreviewItem
  alias GroupherServer.CMS.ContentImport.Threads.Doc

  alias GroupherServer.CMS.ContentImport.Threads.Doc.{
    ItemPayload,
    ItemPreview,
    PlanPayload,
    PreviewPayload
  }

  alias GroupherServer.CMS.ContentImport.Threads.Doc.Plan, as: DocPlan
  alias GroupherServer.CMS.ContentImport.Threads.Doc.Preparation
  alias GroupherServer.CMS.DocTree.Import, as: DocTreeImport
  alias GroupherServer.CMS.Model.{ArticleBranch, DocTreeNode}

  defmodule GitHubClient do
    @behaviour GroupherServer.CMS.ContentImport.Platforms.GitHub.Client

    @impl true
    def fetch_repository(connection, _opts) do
      {:ok,
       %{
         head_sha: "fixture-head",
         tree_sha: "fixture-tree",
         truncated: false,
         entries: Map.fetch!(connection, :tree)
       }}
    end

    @impl true
    def fetch_blob(_connection, blob, _opts), do: {:ok, Map.fetch!(blob, "body")}
  end

  test "framework detection delegates to the matching framework" do
    for {path, framework} <- [
          {"vitepress/basic", "vitepress"},
          {"rspress/basic", "rspress"},
          {"nextra/basic", "nextra"},
          {"docusaurus/basic", "docusaurus"},
          {"mkdocs/basic", "mkdocs"},
          {"starlight/basic", "starlight"},
          {"fumadocs/basic", "fumadocs"}
        ] do
      assert {:ok, %{tree: %{"source" => %{"framework" => ^framework}}}} =
               Doc.parse_tree(fixture(path))
    end
  end

  test "implements ThreadAdapter planning with mapped and newly allocated target refs" do
    assert {:ok, %{tree: source_tree}} = Doc.parse_tree(fixture("nextra/basic"))

    assert {:ok, seed_plan} =
             DocPlan.build(source_tree, %{branch_slug: "seed"},
               id_generator: fn -> "seed-#{System.unique_integer([:positive])}" end
             )

    entries =
      Enum.map(seed_plan["documents"], fn document ->
        Entry.new!(%{
          external_ref: document["sourceId"],
          kind: :file,
          path: document["sourcePath"],
          body: "# #{document["title"]}"
        })
      end)

    first_entry = hd(entries)

    assert {:ok, mapping} =
             Mapping.new(%{
               connection_ref: "connection:1",
               external_ref: first_entry.external_ref,
               thread: :doc,
               target_ref: "article:existing"
             })

    snapshot =
      Snapshot.new!(%{
        platform: :test,
        source_ref: "fixture:nextra",
        entries: entries,
        fetched_at: ~U[2026-07-14 00:00:00Z]
      })

    preparation = preparation(snapshot, source_tree)

    assert {:ok, %Plan{} = plan} =
             Doc.plan(
               snapshot,
               %{community_ref: "home", thread: :doc, scope_ref: "import"},
               %{
                 mappings: [mapping],
                 preparation: preparation,
                 options: [
                   id_generator: fn -> "article:new-#{System.unique_integer([:positive])}" end
                 ]
               }
             )

    imported = Enum.find(plan.items, &(&1.external_ref == first_entry.external_ref))
    assert imported.target_ref == "article:existing"
    assert imported.action == :update
    assert imported.source_hash == first_entry.content_hash
    assert imported.payload.article_hash_id == "article:existing"
    assert imported.payload.content["status"] == "normalized"

    assert Enum.any?(plan.items, &(&1.action == :create))
    assert plan.payload.tree

    assert {:ok,
            %Preview{
              payload: %PreviewPayload{},
              items: [%PreviewItem{payload: %ItemPreview{} = item_preview} | _]
            }} = Doc.project_preview(plan)

    refute Map.has_key?(Map.from_struct(item_preview), :content)
  end

  test "ZIP Snapshot materializes into the same Doc tree and typed Plan as a local fixture" do
    root = fixture("nextra/basic")
    archive = archive_fixture!(root)

    assert {:ok, snapshot} =
             Zip.fetch(%{archive: archive}, fetched_at: ~U[2026-07-14 00:00:00Z])

    assert {:ok, preparation} = Doc.prepare(snapshot)
    imported_tree = preparation.source_tree
    assert {:ok, %{tree: local_tree}} = Doc.parse_tree(root)
    assert imported_tree == local_tree

    assert {:ok, %Plan{} = plan} =
             Doc.plan(
               snapshot,
               %{community_ref: "home", thread: :doc, scope_ref: "zip-import"},
               %{
                 mappings: [],
                 preparation: preparation,
                 options: [
                   id_generator: fn -> "article:#{System.unique_integer([:positive])}" end
                 ]
               }
             )

    assert length(plan.items) ==
             length(
               plan.payload.tree["tabs"]
               |> Enum.flat_map(& &1["groups"])
               |> Enum.flat_map(& &1["children"])
               |> Enum.filter(&(&1["type"] == "page"))
             )

    assert Enum.all?(plan.items, &(&1.action == :create))
    assert Enum.all?(plan.items, &(&1.payload.content["status"] == "normalized"))
  end

  test "GitHub Repository Snapshot materializes into the same Doc tree and typed Plan" do
    root = fixture("nextra/basic")

    connection = %{
      owner: "groupher",
      repo: "docs",
      ref: "main",
      path: "website",
      tree: github_tree_fixture(root, "website")
    }

    assert {:ok, snapshot} =
             Repository.fetch(connection,
               client: GitHubClient,
               max_concurrency: 2,
               fetched_at: ~U[2026-07-14 00:00:00Z]
             )

    assert snapshot.revision == "fixture-head"
    assert {:ok, preparation} = Doc.prepare(snapshot)
    imported_tree = preparation.source_tree
    assert {:ok, %{tree: local_tree}} = Doc.parse_tree(root)
    assert imported_tree == local_tree

    assert {:ok, %Plan{} = plan} =
             Doc.plan(
               snapshot,
               %{community_ref: "home", thread: :doc, scope_ref: "github-import"},
               %{
                 mappings: [],
                 preparation: preparation,
                 options: [
                   id_generator: fn -> Ecto.UUID.generate() end
                 ]
               }
             )

    assert Enum.all?(plan.items, &(&1.action == :create))
    assert Enum.all?(plan.items, &(&1.payload.content["status"] == "normalized"))
  end

  test "deduplicates one remote asset referenced by multiple Doc pages" do
    assert {:ok, %{tree: source_tree}} = Doc.parse_tree(fixture("nextra/basic"))

    assert {:ok, seed_plan} =
             DocPlan.build(source_tree, %{branch_slug: "seed"},
               id_generator: fn -> "seed-#{System.unique_integer([:positive])}" end
             )

    entries =
      Enum.map(seed_plan["documents"], fn document ->
        Entry.new!(%{
          external_ref: document["sourceId"],
          kind: :file,
          path: document["sourcePath"],
          body: "# #{document["title"]}\n\n![shared](https://cdn.example.com/shared.png)"
        })
      end)

    snapshot =
      Snapshot.new!(%{
        platform: :test,
        source_ref: "fixture:nextra-shared-asset",
        entries: entries,
        fetched_at: ~U[2026-07-14 00:00:00Z]
      })

    preparation = preparation(snapshot, source_tree)

    test_process = self()

    assert {:ok, %Plan{} = plan} =
             Doc.plan(
               snapshot,
               %{community_ref: "home", thread: :doc, scope_ref: "asset-import"},
               %{
                 mappings: [],
                 preparation: preparation,
                 options: [
                   downloader: fn _source -> send(test_process, :downloader_called) end,
                   id_generator: fn -> "article:#{System.unique_integer([:positive])}" end
                 ]
               }
             )

    assert [asset] = plan.assets
    assert asset.status == :pending
    assert asset.source == {:remote_url, "https://cdn.example.com/shared.png"}
    assert length(asset.references) == length(plan.items)
    refute Plan.ready_for_apply?(plan)
    refute_receive :downloader_called
  end

  test "rewrites relative Markdown page links to the destination route in the typed Plan" do
    assert {:ok, %{tree: source_tree}} = Doc.parse_tree(fixture("nextra/basic"))

    assert {:ok, seed_plan} =
             DocPlan.build(source_tree, %{branch_slug: "seed"},
               id_generator: fn -> Ecto.UUID.generate() end
             )

    {source_document, target_document} = sibling_documents(seed_plan["documents"])
    relative_link = Path.basename(target_document["sourcePath"])

    entries =
      Enum.map(seed_plan["documents"], fn document ->
        body =
          if document["sourceId"] == source_document["sourceId"],
            do: "Read the [next page](#{relative_link}#details) for more information.",
            else: "Imported page body for #{document["title"]}."

        Entry.new!(%{
          external_ref: document["sourceId"],
          kind: :file,
          path: document["sourcePath"],
          body: body,
          body_format: :md
        })
      end)

    snapshot =
      Snapshot.new!(%{
        platform: :test,
        source_ref: "fixture:nextra-links",
        entries: entries,
        fetched_at: ~U[2026-07-14 00:00:00Z]
      })

    preparation = preparation(snapshot, source_tree)

    assert {:ok, %Plan{} = plan} =
             Doc.plan(
               snapshot,
               %{community_ref: "home", thread: :doc, scope_ref: "link-import"},
               %{mappings: [], preparation: preparation, options: []}
             )

    imported = Enum.find(plan.items, &(&1.external_ref == source_document["sourceId"]))
    body = imported.payload.content["body"]

    assert body =~ target_document["route"] <> "#details"
    refute body =~ relative_link <> "#details"
  end

  test "applies normalized documents and navigation atomically to a Preview branch" do
    {:ok, actor} = db_insert(:user)
    {:ok, community} = db_insert(:community)
    target_ref = Ecto.UUID.generate()
    plan = apply_plan(target_ref, "Imported title", "Imported body", "docs-import")

    {apply_result, queries} =
      capture_queries(fn -> apply_in_transaction(plan, actor, community: community) end)

    assert {:ok, %ApplyResult{} = result} = apply_result
    assert query_count(queries, ~s|INSERT INTO "cms"."doc_tree_nodes"|) == 1

    assert [%{status: :created, target_ref: ^target_ref}] = result.items

    assert %ArticleBranch{type: :preview} =
             branch = Repo.get_by!(ArticleBranch, community_id: community.id, slug: "docs-import")

    assert {:ok, draft} = CMS.Articles.Draft.read(community, :doc, target_ref, branch)
    assert draft.title == "Imported title"

    assert {:ok, tree} = CMS.DocTree.Read.read(community, branch_id: branch.id)
    assert [tab] = tree.tabs
    assert [group] = tab.groups
    assert [page] = group.children
    assert page.doc_id == target_ref

    assert Repo.aggregate(from(node in DocTreeNode, where: node.branch_id == ^branch.id), :count) ==
             3

    assert {:error, _} = CMS.Articles.Draft.read_public(community, :doc, target_ref, branch)

    update_plan = apply_plan(target_ref, "Updated title", "Updated body", "docs-import", :update)

    assert {:ok, %ApplyResult{items: [%{status: :updated}]}} =
             apply_in_transaction(update_plan, actor, community: community)

    assert {:ok, updated} = CMS.Articles.Draft.read(community, :doc, target_ref, branch)
    assert updated.title == "Updated title"

    assert Repo.aggregate(from(node in DocTreeNode, where: node.branch_id == ^branch.id), :count) ==
             3
  end

  test "rolls back the Preview branch and earlier items when one imported document fails" do
    {:ok, actor} = db_insert(:user)
    {:ok, community} = db_insert(:community)
    first_ref = Ecto.UUID.generate()
    first = apply_item(first_ref, "First", "First body", :create)
    invalid = apply_item("not-a-uuid", "Invalid", "Invalid body", :create)

    plan =
      Plan.new!(%{
        thread: :doc,
        items: [first, invalid],
        assets: [],
        payload: apply_payload([first, invalid], "broken-import")
      })

    assert {:error, [%{code: "doc_apply_failed"}]} =
             apply_in_transaction(plan, actor, community: community)

    refute Repo.exists?(
             from(branch in ArticleBranch,
               where: branch.community_id == ^community.id and branch.slug == "broken-import"
             )
           )
  end

  test "batches 100 and 1000 imported tree children by configured batch size" do
    {:ok, actor} = db_insert(:user)
    {:ok, community} = db_insert(:community)

    for child_count <- [100, 1000] do
      {:ok, branch} =
        CMS.Articles.Branch.create_preview(
          community,
          :doc,
          %{slug: "tree-batch-#{child_count}", title: "Tree batch #{child_count}"},
          actor
        )

      tree = link_tree(child_count)

      {{:ok, %{nodes: nodes}}, queries} =
        capture_queries(fn ->
          Repo.transaction(fn ->
            case DocTreeImport.apply(community, branch, tree, %{}) do
              {:ok, result} -> result
              {:error, reason} -> Repo.rollback(reason)
            end
          end)
        end)

      assert length(nodes) == child_count + 2

      expected_batches = ceil((child_count + 2) / 500)
      assert query_count(queries, ~s|INSERT INTO "cms"."doc_tree_nodes"|) == expected_batches
    end
  end

  test "keeps the last occurrence when a source node identity is repeated" do
    {:ok, actor} = db_insert(:user)
    {:ok, community} = db_insert(:community)

    {:ok, branch} =
      CMS.Articles.Branch.create_preview(
        community,
        :doc,
        %{slug: "duplicate-source-node", title: "Duplicate source node"},
        actor
      )

    tree = duplicate_source_node_tree()

    assert {:ok, %{nodes: nodes}} =
             Repo.transaction(fn ->
               case DocTreeImport.apply(community, branch, tree, %{}) do
                 {:ok, result} -> result
                 {:error, reason} -> Repo.rollback(reason)
               end
             end)

    assert length(nodes) == 5

    link =
      Repo.get_by!(DocTreeNode,
        community_id: community.id,
        branch_id: branch.id,
        type: :link
      )

    second_group =
      Repo.get_by!(DocTreeNode,
        community_id: community.id,
        branch_id: branch.id,
        type: :group,
        title: "Second"
      )

    assert link.title == "Repeated last"
    assert link.href == "https://example.com/last"
    assert link.group_id == second_group.node_id
  end

  test "dry-run accepts pending assets and performs no database writes" do
    {:ok, actor} = db_insert(:user)
    {:ok, community} = db_insert(:community)
    target_ref = Ecto.UUID.generate()
    item = apply_item(target_ref, "Dry run", "Body", :create)

    pending_asset =
      Asset.new!(%{
        asset_key: "asset_pending",
        source: {:remote_url, "https://cdn.example.com/pending.png"}
      })

    plan =
      Plan.new!(%{
        thread: :doc,
        items: [item],
        assets: [pending_asset],
        payload: apply_payload([item], "dry-run-import")
      })

    assert {:ok, %ApplyResult{items: [%{status: :skipped}]}} =
             apply_in_transaction(plan, actor, community: community, dry_run: true)

    refute Repo.exists?(
             from(branch in ArticleBranch,
               where: branch.community_id == ^community.id and branch.slug == "dry-run-import"
             )
           )
  end

  test "resolves staged asset placeholders before writing a Doc document" do
    {:ok, actor} = db_insert(:user)
    {:ok, community} = db_insert(:community)
    target_ref = Ecto.UUID.generate()
    item = apply_item(target_ref, "With asset", "Imported logo image", :create)
    asset_key = "asset_logo"

    body =
      Jason.encode!([
        %{
          "type" => "p",
          "children" => [
            %{
              "type" => "a",
              "url" => "content-import://asset/#{asset_key}",
              "assetKey" => asset_key,
              "children" => [%{"text" => "Imported logo image"}]
            }
          ]
        }
      ])

    item = %{
      item
      | payload: %{
          item.payload
          | content: %{
              "status" => "normalized",
              "schemaVersion" => 1,
              "body" => body,
              "assetKeys" => [asset_key]
            }
        }
    }

    pending =
      Asset.new!(%{
        asset_key: asset_key,
        source: {:remote_url, "https://source.example.com/logo.png"}
      })

    {:ok, staging} = Asset.transition(pending, :staging)

    {:ok, ready} =
      Asset.transition(staging, :ready, %{
        content_hash: String.duplicate("c", 64),
        staging_ref: "staging://logo"
      })

    plan =
      Plan.new!(%{
        thread: :doc,
        items: [item],
        assets: [ready],
        payload: apply_payload([item], "asset-import")
      })

    resolver = fn asset, resolved_community, resolved_actor, _opts ->
      assert asset.asset_key == asset_key
      assert resolved_community.id == community.id
      assert resolved_actor.id == actor.id

      {:ok,
       %{
         target_ref: "asset:public-logo",
         url: "https://assets.example.com/logo.png",
         status: :reused
       }}
    end

    assert {:ok, %ApplyResult{assets: [%{status: :reused}]}} =
             apply_in_transaction(plan, actor,
               community: community,
               asset_resolver: resolver
             )

    branch = Repo.get_by!(ArticleBranch, community_id: community.id, slug: "asset-import")
    {:ok, draft} = CMS.Articles.Draft.read(community, :doc, target_ref, branch)
    document = Repo.preload(draft, :document).document

    assert document.json =~ "https://assets.example.com/logo.png"
    refute document.json =~ "content-import://asset/"
  end

  defp archive_fixture!(root) do
    entries =
      root
      |> Path.join("**/*")
      |> Path.wildcard(match_dot: true)
      |> Enum.filter(&File.regular?/1)
      |> Enum.map(fn path ->
        {path |> Path.relative_to(root) |> String.to_charlist(), File.read!(path)}
      end)

    {:ok, {_name, archive}} = :zip.create(~c"docs.zip", entries, [:memory])
    archive
  end

  defp github_tree_fixture(root, prefix) do
    root
    |> Path.join("**/*")
    |> Path.wildcard(match_dot: true)
    |> Enum.filter(&File.regular?/1)
    |> Enum.map(fn path ->
      body = File.read!(path)
      relative_path = Path.relative_to(path, root)

      %{
        "path" => Path.join(prefix, relative_path),
        "sha" => :sha |> :crypto.hash(body) |> Base.encode16(case: :lower),
        "type" => "blob",
        "size" => byte_size(body),
        "body" => body
      }
    end)
  end

  defp sibling_documents(documents) do
    Enum.find_value(documents, fn source ->
      Enum.find_value(documents, fn target ->
        if source != target and
             Path.dirname(source["sourcePath"]) == Path.dirname(target["sourcePath"]),
           do: {source, target}
      end)
    end) || flunk("fixture must contain two documents in the same source directory")
  end

  defp preparation(snapshot, source_tree) do
    framework =
      source_tree
      |> get_in(["source", "framework"])
      |> String.to_existing_atom()

    Preparation.new!(snapshot, framework, source_tree)
  end

  defp apply_plan(target_ref, title, text, branch_slug, action \\ :create) do
    item = apply_item(target_ref, title, text, action)

    Plan.new!(%{
      thread: :doc,
      items: [item],
      assets: [],
      payload: apply_payload([item], branch_slug)
    })
  end

  defp apply_item(target_ref, title, text, action) do
    body = Jason.encode!([%{"type" => "p", "children" => [%{"text" => text}]}])

    Item.new!(%{
      external_ref: "docs/#{String.slice(target_ref, 0, 12)}.md",
      target_ref: target_ref,
      action: action,
      source_hash: String.duplicate("a", 64),
      payload:
        ItemPayload.new!(%{
          article_hash_id: target_ref,
          title: title,
          slug: "page-#{String.slice(target_ref, 0, 8)}",
          route: "/guide/page-#{String.slice(target_ref, 0, 8)}",
          content: %{
            "status" => "normalized",
            "schemaVersion" => 1,
            "body" => body,
            "assetKeys" => []
          }
        })
    })
  end

  defp apply_payload(items, branch_slug) do
    children =
      Enum.map(items, fn item ->
        %{
          "type" => "page",
          "sourceId" => item.external_ref,
          "title" => item.payload.title,
          "slug" => item.payload.slug,
          "route" => item.payload.route,
          "docId" => item.target_ref
        }
      end)

    PlanPayload.new!(%{
      schema_version: 1,
      source: %{"framework" => "test"},
      target: %{
        "thread" => "doc",
        "branch" => %{
          "type" => "preview",
          "slug" => branch_slug,
          "title" => "Imported docs"
        }
      },
      tree: %{
        "tabs" => [
          %{
            "sourceId" => "scope:guide",
            "title" => "Guide",
            "slug" => "guide",
            "pins" => [],
            "groups" => [
              %{
                "sourceId" => "section:guide",
                "title" => "Guide",
                "slug" => "guide",
                "children" => children
              }
            ]
          }
        ]
      }
    })
  end

  defp link_tree(child_count) do
    children =
      Enum.map(1..child_count, fn index ->
        %{
          "type" => "link",
          "sourceId" => "link:#{index}",
          "title" => "Link #{index}",
          "slug" => "link-#{index}",
          "href" => "https://example.com/#{index}"
        }
      end)

    %{
      "tabs" => [
        %{
          "sourceId" => "scope:benchmark",
          "title" => "Benchmark",
          "slug" => "benchmark",
          "pins" => [],
          "groups" => [
            %{
              "sourceId" => "section:benchmark",
              "title" => "Benchmark",
              "slug" => "benchmark",
              "children" => children
            }
          ]
        }
      ]
    }
  end

  defp duplicate_source_node_tree do
    groups =
      Enum.map([{"First", "first"}, {"Second", "second"}], fn {title, key} ->
        suffix = if key == "first", do: "first", else: "last"

        %{
          "sourceId" => "section:#{key}",
          "title" => title,
          "slug" => key,
          "children" => [
            %{
              "type" => "link",
              "sourceId" => "link:repeated",
              "title" => "Repeated #{suffix}",
              "slug" => "repeated-#{suffix}",
              "href" => "https://example.com/#{suffix}"
            }
          ]
        }
      end)

    %{
      "tabs" => [
        %{
          "sourceId" => "scope:duplicate",
          "title" => "Duplicate",
          "slug" => "duplicate",
          "pins" => [],
          "groups" => groups
        }
      ]
    }
  end

  defp apply_in_transaction(plan, actor, opts) do
    Repo.transaction(fn ->
      case Doc.apply_in_transaction(plan, actor, opts) do
        {:ok, result} -> result
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
  end

  defp capture_queries(fun) do
    handler_id = {__MODULE__, make_ref()}
    test_pid = self()

    :ok =
      :telemetry.attach(
        handler_id,
        [:groupher_server, :repo, :query],
        fn _event, _measurements, metadata, _config ->
          if self() == test_pid, do: send(test_pid, {handler_id, metadata.query})
        end,
        nil
      )

    try do
      result = fun.()
      {result, drain_queries(handler_id, [])}
    after
      :telemetry.detach(handler_id)
    end
  end

  defp drain_queries(handler_id, queries) do
    receive do
      {^handler_id, query} -> drain_queries(handler_id, [query | queries])
    after
      0 -> Enum.reverse(queries)
    end
  end

  defp query_count(queries, pattern), do: Enum.count(queries, &String.contains?(&1, pattern))
end
