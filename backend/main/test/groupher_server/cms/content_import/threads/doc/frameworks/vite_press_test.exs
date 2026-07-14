defmodule GroupherServer.CMS.ContentImport.Threads.Doc.Frameworks.VitePressTest do
  use GroupherServer.CMS.ContentImport.FrameworkCase, async: true

  alias GroupherServer.CMS.ContentImport.Threads.Doc.Frameworks.VitePress

  test "preserves its sidebar as a source tree" do
    assert_golden(VitePress, "vitepress/basic")
  end

  test "resolves additional config, base paths and static sidebar functions" do
    root = fixture("vitepress/additional_config")

    assert {:ok, %{tree: tree, diagnostics: []}} = VitePress.parse(root)

    assert tree["source"] == %{
             "framework" => "vitepress",
             "root" => "docs/en",
             "configPaths" => ["docs/config.ts"]
           }

    [guide, reference] = tree["navigation"]
    assert guide["routePrefix"] == "/guide/"

    assert Enum.map(hd(guide["children"])["children"], & &1["route"]) == [
             "/guide/what-is-vitepress",
             "/guide/getting-started"
           ]

    [reference_section] = reference["children"]
    [site_config, default_theme] = reference_section["children"]
    assert site_config["sourcePath"] == "docs/en/reference/site-config.md"

    assert Enum.map(default_theme["children"], & &1["sourcePath"]) == [
             "docs/en/reference/default-theme-config.md",
             "docs/en/reference/default-theme-sidebar.md"
           ]
  end

  test "rejects dynamic configuration without executing it" do
    root =
      Path.join(System.tmp_dir!(), "content-import-dynamic-#{System.unique_integer([:positive])}")

    config = Path.join(root, "docs/.vitepress/config.ts")
    on_exit(fn -> File.rm_rf(root) end)

    File.mkdir_p!(Path.dirname(config))

    File.write!(
      config,
      "export default defineConfig({ themeConfig: { sidebar: makeSidebar() } })"
    )

    assert {:error, %{code: "dynamic_config"}} = VitePress.parse(root)
  end
end
