defmodule GroupherServer.CMS.ContentImport.WorkspaceTest do
  use ExUnit.Case, async: true

  alias GroupherServer.CMS.ContentImport.{Entry, Snapshot, Workspace}

  test "materializes file and asset Entries into a read-only workspace" do
    snapshot =
      snapshot([entry("docs/index.md", "# Home"), entry("docs/logo.svg", "<svg />", :asset)])

    assert {:ok, workspace} = Workspace.materialize(snapshot)
    on_exit(fn -> Workspace.cleanup(workspace) end)

    assert File.read!(Path.join(workspace.root, "docs/index.md")) == "# Home"
    assert File.read!(Path.join(workspace.root, "docs/logo.svg")) == "<svg />"
    assert {:ok, stat} = File.stat(Path.join(workspace.root, "docs/index.md"))
    assert Bitwise.band(stat.mode, 0o222) == 0
  end

  test "rejects paths that escape the workspace root" do
    snapshot = snapshot([entry("../outside.md", "no")])

    assert {:error, %{code: "unsafe_workspace_path"}} = Workspace.materialize(snapshot)
  end

  defp entry(path, body, kind \\ :file) do
    Entry.new!(%{external_ref: path, kind: kind, path: path, body: body})
  end

  defp snapshot(entries) do
    Snapshot.new!(%{
      platform: :test,
      source_ref: "test:workspace",
      entries: entries,
      fetched_at: ~U[2026-07-14 00:00:00Z]
    })
  end
end
