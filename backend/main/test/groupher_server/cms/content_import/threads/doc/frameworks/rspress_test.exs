defmodule GroupherServer.CMS.ContentImport.Threads.Doc.Frameworks.RspressTest do
  use GroupherServer.CMS.ContentImport.FrameworkCase, async: true

  alias GroupherServer.CMS.ContentImport.Threads.Doc.Frameworks.Rspress

  test "preserves its sidebar as a source tree" do
    assert_golden(Rspress, "rspress/basic")
  end

  test "reads _nav, _meta, section headers and i18n labels" do
    root = fixture("rspress/auto_navigation")

    assert {:ok, %{tree: tree, diagnostics: []}} = Rspress.parse(root)
    assert tree["source"]["root"] == "docs/en"
    assert tree["source"]["configPaths"] == ["rspress.config.ts", "docs/en/_nav.json"]

    assert Enum.map(tree["navigation"], & &1["title"]) == ["Guide", "API"]
    [guide, api] = tree["navigation"]
    assert Enum.map(guide["children"], & &1["title"]) == ["Getting Started", "More"]

    assert guide["children"] |> hd() |> Map.fetch!("children") |> Enum.map(& &1["title"]) == [
             "Introduction",
             "Quick Start"
           ]

    assert Enum.map(api["children"], & &1["title"]) == ["Overview", "Config"]
  end
end
