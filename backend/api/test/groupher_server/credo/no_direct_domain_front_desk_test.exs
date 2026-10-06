Code.require_file(Path.expand("../../../credo_checks/no_direct_domain_front_desk.ex", __DIR__))

defmodule GroupherServer.Test.Credo.NoDirectDomainFrontDeskTest do
  use Credo.Test.Case, async: false

  alias GroupherServer.Credo.Check.NoDirectDomainFrontDesk

  setup_all do
    {:ok, _apps} = Application.ensure_all_started(:credo)
    :ok
  end

  test "rejects domain FrontDesk calls in web boundaries" do
    issues =
      "CMS.FrontDesk.article(path)"
      |> to_source_file("lib/groupher_server_web/resolvers/example.ex")
      |> run_check(NoDirectDomainFrontDesk)

    assert length(issues) == 1
  end

  test "rejects domain FrontDesk aliases in cross-domain boundaries" do
    issues =
      "alias CMS.FrontDesk"
      |> to_source_file("lib/groupher_server/accounts/example.ex")
      |> run_check(NoDirectDomainFrontDesk)

    assert length(issues) == 1
  end

  test "allows the root FrontDesk facade" do
    issues =
      "FrontDesk.article(path)"
      |> to_source_file("lib/groupher_server_web/resolvers/example.ex")
      |> run_check(NoDirectDomainFrontDesk)

    assert issues == []
  end
end
