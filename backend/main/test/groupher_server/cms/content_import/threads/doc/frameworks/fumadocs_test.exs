defmodule GroupherServer.CMS.ContentImport.Threads.Doc.Frameworks.FumadocsTest do
  use GroupherServer.CMS.ContentImport.FrameworkCase, async: true

  alias GroupherServer.CMS.ContentImport.Threads.Doc.Frameworks.Fumadocs

  test "reads meta order, separators, folders, wildcards and links" do
    root = fixture("fumadocs/basic")

    assert {:ok, %{tree: tree, diagnostics: []}} = Fumadocs.parse(root)

    assert tree["source"] == %{
             "framework" => "fumadocs",
             "root" => "content/docs",
             "configPaths" => [
               "source.config.ts",
               "content/docs/guide/meta.json",
               "content/docs/meta.json"
             ]
           }

    [scope] = tree["navigation"]
    assert scope["title"] == "Fixture Docs"

    assert Enum.map(scope["children"], &{&1["kind"], &1["title"]}) == [
             {"page", "Welcome"},
             {"section", "Guides"}
           ]

    guide_children = scope["children"] |> Enum.at(1) |> Map.fetch!("children")

    assert Enum.map(guide_children, &{&1["kind"], &1["title"]}) == [
             {"section", "Guide"},
             {"link", "Project"},
             {"page", "Changelog"}
           ]
  end

  test "reports explicitly configured missing pages and folders" do
    root = Path.join(System.tmp_dir!(), "fumadocs-missing-#{System.unique_integer([:positive])}")
    docs = Path.join(root, "content/docs")
    on_exit(fn -> File.rm_rf(root) end)
    File.mkdir_p!(docs)
    File.write!(Path.join(root, "source.config.ts"), "export const docs = {}")

    File.write!(
      Path.join(docs, "meta.json"),
      Jason.encode!(%{
        "pages" => [
          "missing-page",
          %{"type" => "folder", "name" => "missing-folder"}
        ]
      })
    )

    assert {:ok, %{tree: tree, diagnostics: diagnostics}} = Fumadocs.parse(root)

    assert Enum.map(diagnostics, &{&1.code, &1.source_id}) == [
             {"page_not_found", "missing-page"},
             {"folder_not_found", "missing-folder"}
           ]

    assert tree["navigation"] |> hd() |> Map.fetch!("children") == []
  end
end
