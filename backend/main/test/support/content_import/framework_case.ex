defmodule GroupherServer.CMS.ContentImport.FrameworkCase do
  @moduledoc false

  use ExUnit.CaseTemplate

  using do
    quote do
      import GroupherServer.CMS.ContentImport.FrameworkCase
    end
  end

  @fixtures Path.expand("../../fixtures/content_import/threads/doc/frameworks", __DIR__)

  def fixture(path), do: Path.join(@fixtures, path)

  def assert_golden(adapter, path) do
    root = fixture(path)
    expected = root |> Path.join("expected/tree.json") |> File.read!() |> Jason.decode!()

    ExUnit.Assertions.assert({:ok, %{tree: tree, diagnostics: []}} = adapter.parse(root))
    ExUnit.Assertions.assert(tree == expected)
  end
end
