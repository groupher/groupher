Code.require_file(Path.expand("../../../credo_checks/no_direct_orm_in_transport.ex", __DIR__))

defmodule GroupherServer.Test.Credo.NoDirectOrmInTransportTest do
  use Credo.Test.Case, async: false

  alias GroupherServer.Credo.Check.NoDirectOrmInTransport

  setup_all do
    {:ok, _apps} = Application.ensure_all_started(:credo)
    :ok
  end

  test "rejects ORM access in a resolver" do
    source = """
    defmodule GroupherServerWeb.ExampleResolver do
      alias Helper.ORM

      def load(id), do: ORM.find(GroupherServer.CMS.Model.Article, id)
    end
    """

    issues =
      source
      |> to_source_file("lib/groupher_server_web/example_resolver.ex")
      |> run_check(NoDirectOrmInTransport)

    assert length(issues) == 2
  end

  test "rejects fully qualified ORM access in a schema boundary" do
    source = """
    defmodule GroupherServerWeb.Schema.Example do
      def load(id), do: Helper.ORM.find(GroupherServer.CMS.Model.Article, id)
    end
    """

    issues =
      source
      |> to_source_file("lib/groupher_server_web/schema/example.ex")
      |> run_check(NoDirectOrmInTransport)

    assert length(issues) == 1
  end

  test "allows ORM inside an owning Reader" do
    source = """
    defmodule GroupherServer.CMS.Articles.Reader do
      alias Helper.ORM

      def load(id), do: ORM.find(GroupherServer.CMS.Model.Article, id)
    end
    """

    issues =
      source
      |> to_source_file("lib/groupher_server/cms/articles/reader.ex")
      |> run_check(NoDirectOrmInTransport)

    assert issues == []
  end
end
