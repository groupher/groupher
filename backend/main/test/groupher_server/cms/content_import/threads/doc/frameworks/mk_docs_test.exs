defmodule GroupherServer.CMS.ContentImport.Threads.Doc.Frameworks.MkDocsTest do
  use GroupherServer.CMS.ContentImport.FrameworkCase, async: true

  alias GroupherServer.CMS.ContentImport.Threads.Doc.Frameworks.MkDocs

  test "reads nested nav, bare pages and external links" do
    root = fixture("mkdocs/basic")

    assert {:ok, %{tree: tree, diagnostics: []}} = MkDocs.parse(root)

    assert tree["source"] == %{
             "framework" => "mkdocs",
             "root" => "content",
             "configPaths" => ["mkdocs.yml"]
           }

    [scope] = tree["navigation"]

    assert Enum.map(scope["children"], &{&1["kind"], &1["title"]}) == [
             {"page", "Home"},
             {"section", "Guide"},
             {"page", "API"},
             {"link", "Project"}
           ]

    [start, advanced] = scope["children"] |> Enum.at(1) |> Map.fetch!("children")
    assert start["sourcePath"] == "content/guide/start.md"
    assert advanced["title"] == "Advanced Topics"
  end

  test "infers navigation when nav is absent" do
    root = fixture("mkdocs/automatic")

    assert {:ok, %{tree: tree, diagnostics: []}} = MkDocs.parse(root)
    [scope] = tree["navigation"]

    assert Enum.map(scope["children"], &{&1["kind"], &1["title"]}) == [
             {"page", "Welcome"},
             {"section", "Reference"}
           ]
  end
end
