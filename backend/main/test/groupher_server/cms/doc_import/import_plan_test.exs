defmodule GroupherServer.CMS.DocImport.ImportPlanTest do
  use ExUnit.Case, async: true

  alias GroupherServer.CMS.DocImport.Adapters.Nextra
  alias GroupherServer.CMS.DocImport.ImportPlan

  @fixture Path.expand("../../../fixtures/doc_import/nextra/basic", __DIR__)

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
             ImportPlan.build(
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
             ImportPlan.build(source_tree, %{})
  end
end
