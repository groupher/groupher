defmodule GroupherServer.CMS.ContentImport.Threads.Doc.Frameworks.NextraTest do
  use GroupherServer.CMS.ContentImport.FrameworkCase, async: true

  alias GroupherServer.CMS.ContentImport.Threads.Doc.Frameworks.Nextra

  test "preserves page and directory nesting without invented groups" do
    assert_golden(Nextra, "nextra/basic")
  end

  test "reads App Router global meta, local constants and JSX labels" do
    root = fixture("nextra/app_router")

    assert {:ok, %{tree: tree, diagnostics: []}} = Nextra.parse(root)
    assert tree["source"]["root"] == "app"
    assert tree["source"]["configPaths"] == ["app/_meta.global.tsx"]

    assert Enum.map(tree["navigation"], & &1["title"]) == ["Documentation", "API"]
    [docs, api] = tree["navigation"]
    assert api["children"] |> hd() |> Map.fetch!("route") == "/api"

    assert Enum.map(docs["children"], &{&1["kind"], &1["title"]}) == [
             {"page", "Docs"},
             {"page", "Getting Started"},
             {"section", "More"}
           ]

    [external] = docs["children"] |> List.last() |> Map.fetch!("children")
    assert external["title"] == "External Guide"
    assert external["href"] == "https://example.com/guide"
  end
end
