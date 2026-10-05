Code.require_file(Path.expand("../../../credo_checks/no_wrapped_inline_do.ex", __DIR__))

defmodule GroupherServer.Test.Credo.NoWrappedInlineDoTest do
  use Credo.Test.Case, async: false

  alias GroupherServer.Credo.Check.NoWrappedInlineDo

  setup_all do
    {:ok, _apps} = Application.ensure_all_started(:credo)
    :ok
  end

  test "allows a definition that stays on one physical line" do
    source = "def published?(article), do: article.stage == :published\n"

    issues =
      source
      |> to_source_file("lib/example.ex")
      |> run_check(NoWrappedInlineDo)

    assert issues == []
  end

  test "rejects a wrapped inline definition" do
    source = """
    def publish(article, actor, opts),
      do: Commands.Publish.execute(article, actor, opts)
    """

    issues =
      source
      |> to_source_file("lib/example.ex")
      |> run_check(NoWrappedInlineDo)

    assert [%{line_no: 1, trigger: "def"}] = issues
  end

  test "rejects wrapped inline control-flow forms" do
    source = """
    def example(value) do
      if value,
        do: :ok

      with {:ok, result} <- load(value),
        do: result
    end
    """

    issues =
      source
      |> to_source_file("lib/example.ex")
      |> run_check(NoWrappedInlineDo)

    assert Enum.map(issues, & &1.trigger) |> Enum.sort() == ["if", "with"]
  end

  test "allows block-style expressions" do
    source = """
    def example(value) do
      case value do
        :ok -> :done
        _ -> :error
      end
    end
    """

    issues =
      source
      |> to_source_file("lib/example.ex")
      |> run_check(NoWrappedInlineDo)

    assert issues == []
  end

  test "allows a multiline function-head declaration" do
    source = """
    def callback(
          first,
          second
        )
    """

    issues =
      source
      |> to_source_file("lib/example.ex")
      |> run_check(NoWrappedInlineDo)

    assert issues == []
  end

  test "ignores quoted source" do
    source = """
    def quoted do
      quote do
        def generated(value),
          do: value
      end
    end
    """

    issues =
      source
      |> to_source_file("lib/example.ex")
      |> run_check(NoWrappedInlineDo)

    assert issues == []
  end
end
