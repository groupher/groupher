defmodule GroupherServer.CMS.DocImport.DocumentFileTest do
  use ExUnit.Case, async: true

  alias GroupherServer.CMS.DocImport.DocumentFile

  setup do
    root = Path.join(System.tmp_dir!(), "doc-file-#{System.unique_integer([:positive])}")
    on_exit(fn -> File.rm_rf(root) end)
    File.mkdir_p!(Path.join(root, "guide"))

    File.write!(
      Path.join(root, "guide/index.mdx"),
      "---\ntitle: Guide Home\nsidebar:\n  order: 2\n---\n\n# Ignored Heading"
    )

    File.write!(Path.join(root, "start.md"), "# Getting Started")
    File.write!(Path.join(root, "_meta.json"), "{}")
    %{root: root}
  end

  test "resolves documents, frontmatter, titles and routes", %{root: root} do
    path = DocumentFile.resolve(root, "guide")

    assert path == Path.join(root, "guide/index.mdx")
    assert DocumentFile.frontmatter(path) == %{"title" => "Guide Home", "sidebar.order" => "2"}
    assert DocumentFile.title(path, "guide") == "Guide Home"
    assert DocumentFile.declared_title(path) == "Guide Home"
    assert DocumentFile.integer(DocumentFile.frontmatter(path), "sidebar.order") == 2
    assert DocumentFile.route(path, root) == "/guide"
    assert DocumentFile.title(Path.join(root, "start.md"), "start") == "Getting Started"
  end

  test "lists only visible Markdown files and directories", %{root: root} do
    assert Enum.map(DocumentFile.entries(root), &{&1.kind, &1.name}) == [
             {:directory, "guide"},
             {:file, "start.md"}
           ]
  end
end
