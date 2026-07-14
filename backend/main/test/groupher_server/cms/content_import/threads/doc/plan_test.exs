defmodule GroupherServer.CMS.ContentImport.Threads.Doc.PlanTest do
  use ExUnit.Case, async: true

  alias GroupherServer.CMS.ContentImport.Mapping
  alias GroupherServer.CMS.ContentImport.Threads.Doc.Frameworks.Nextra
  alias GroupherServer.CMS.ContentImport.Threads.Doc.Plan

  @fixture Path.expand(
             "../../../../../fixtures/content_import/threads/doc/frameworks/nextra/basic",
             __DIR__
           )

  test "targets a Doc Preview Branch and binds pages to stable Article identities" do
    assert {:ok, %{tree: source_tree}} = Nextra.parse(@fixture)

    ids = [
      "00000000-0000-4000-8000-000000000001",
      "00000000-0000-4000-8000-000000000002",
      "00000000-0000-4000-8000-000000000003",
      "00000000-0000-4000-8000-000000000004"
    ]

    Process.put(:import_plan_ids, ids)
    on_exit(fn -> Process.delete(:import_plan_ids) end)

    id_generator = fn ->
      [id | rest] = Process.get(:import_plan_ids)
      Process.put(:import_plan_ids, rest)
      id
    end

    assert {:ok, plan} =
             Plan.build(
               source_tree,
               %{branch_slug: "import-vitepress", branch_title: "VitePress import"},
               id_generator: id_generator
             )

    assert plan["target"] == %{
             "thread" => "doc",
             "branch" => %{
               "type" => "preview",
               "slug" => "import-vitepress",
               "title" => "VitePress import"
             }
           }

    assert Enum.map(plan["documents"], & &1["articleHashId"]) == ids
    assert Enum.all?(plan["documents"], &(&1["content"] == %{"status" => "pending"}))

    tree_doc_ids =
      plan["tree"]["tabs"]
      |> Enum.flat_map(& &1["groups"])
      |> Enum.flat_map(& &1["children"])
      |> Enum.filter(&(&1["type"] == "page"))
      |> Enum.map(& &1["docId"])

    assert tree_doc_ids == ids
  end

  test "requires an explicit Preview Branch slug" do
    assert {:ok, %{tree: source_tree}} = Nextra.parse(@fixture)

    assert {:error, %{code: "preview_branch_slug_required"}} =
             Plan.build(source_tree, %{})
  end

  test "reuses a persisted mapping target ref and allocates refs only for new pages" do
    assert {:ok, %{tree: source_tree}} = Nextra.parse(@fixture)

    assert {:ok, initial_plan} =
             Plan.build(source_tree, %{branch_slug: "import"},
               id_generator: fn -> "generated-#{System.unique_integer([:positive])}" end
             )

    first_document = hd(initial_plan["documents"])

    assert {:ok, mapping} =
             Mapping.new(%{
               connection_ref: "connection:1",
               external_ref: first_document["sourceId"],
               thread: :doc,
               target_ref: "article:existing"
             })

    assert {:ok, plan} =
             Plan.build(source_tree, %{branch_slug: "import"},
               mappings: [mapping],
               id_generator: fn -> "article:new-#{System.unique_integer([:positive])}" end
             )

    imported = Enum.find(plan["documents"], &(&1["sourceId"] == mapping.external_ref))
    assert imported["articleHashId"] == "article:existing"
  end
end
