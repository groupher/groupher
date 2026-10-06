Code.require_file(
  Path.expand("../../../credo_checks/no_external_effects_in_commands.ex", __DIR__)
)

defmodule GroupherServer.Test.Credo.NoExternalEffectsInCommandsTest do
  use Credo.Test.Case, async: false

  alias GroupherServer.Credo.Check.NoExternalEffectsInCommands

  setup_all do
    {:ok, _apps} = Application.ensure_all_started(:credo)
    :ok
  end

  test "rejects direct HTTP and task calls in a command module" do
    source = """
    defmodule GroupherServer.CMS.Articles.Commands.Publish do
      def run do
        Req.post("https://example.test")
        Task.start(fn -> :ok end)
      end
    end
    """

    issues =
      source
      |> to_source_file("lib/groupher_server/cms/articles/commands/publish.ex")
      |> run_check(NoExternalEffectsInCommands)

    assert length(issues) == 2
  end

  test "rejects external clients in the public Command boundary" do
    source = """
    defmodule GroupherServer.CMS.Command do
      alias Tesla

      def execute, do: Tesla.request(method: :get, url: "/")
    end
    """

    issues =
      source
      |> to_source_file("lib/groupher_server/cms/command.ex")
      |> run_check(NoExternalEffectsInCommands)

    assert length(issues) == 2
  end

  test "allows transactional Outbox intent persistence" do
    source = """
    defmodule GroupherServer.CMS.Articles.Commands.Publish do
      def run(attrs), do: GroupherServer.CMS.Outbox.send(attrs)
    end
    """

    issues =
      source
      |> to_source_file("lib/groupher_server/cms/articles/commands/publish.ex")
      |> run_check(NoExternalEffectsInCommands)

    assert issues == []
  end

  test "ignores external clients in owning effect workers" do
    source = """
    defmodule GroupherServer.CMS.Search.Worker do
      def run, do: Req.post("https://example.test")
    end
    """

    issues =
      source
      |> to_source_file("lib/groupher_server/cms/search/worker.ex")
      |> run_check(NoExternalEffectsInCommands)

    assert issues == []
  end
end
