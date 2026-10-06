Code.require_file(Path.expand("../../../credo_checks/no_direct_repo_in_boundaries.ex", __DIR__))

defmodule GroupherServer.Test.Credo.NoDirectRepoInBoundariesTest do
  use Credo.Test.Case, async: false

  alias GroupherServer.Credo.Check.NoDirectRepoInBoundaries

  setup_all do
    {:ok, _apps} = Application.ensure_all_started(:credo)
    :ok
  end

  test "rejects aliased Repo access in web and command boundaries" do
    source = """
    defmodule GroupherServerWeb.ExampleResolver do
      alias GroupherServer.{CMS, Repo}

      def load(id), do: Repo.get(CMS.Model.Article, id)
    end
    """

    issues =
      source
      |> to_source_file("lib/groupher_server_web/example_resolver.ex")
      |> run_check(NoDirectRepoInBoundaries)

    assert length(issues) == 2
  end

  test "rejects fully qualified Repo access in command modules" do
    source = """
    defmodule GroupherServer.CMS.Articles.Commands.Example do
      def load(id), do: GroupherServer.Repo.get(GroupherServer.CMS.Model.Article, id)
    end
    """

    issues =
      source
      |> to_source_file("lib/groupher_server/cms/articles/commands/example.ex")
      |> run_check(NoDirectRepoInBoundaries)

    assert length(issues) == 1
  end

  test "allows Repo inside an explicit writer boundary" do
    source = """
    defmodule GroupherServer.CMS.Articles.Writer do
      alias GroupherServer.Repo

      def load(id), do: Repo.get(GroupherServer.CMS.Model.Article, id)
    end
    """

    issues =
      source
      |> to_source_file("lib/groupher_server/cms/articles/writer.ex")
      |> run_check(NoDirectRepoInBoundaries)

    assert issues == []
  end
end
