Code.require_file("../../dev/local_test_actors/guard.ex", __DIR__)

defmodule GroupherServer.LocalTestActorsGuardTest do
  use ExUnit.Case, async: false
  alias GroupherServer.LocalTestActors
  alias LocalTestActors.Guard

  @variables %{
    "DEV_HUB_MANAGED_ENVIRONMENT" => "true",
    "LOCAL_TEST_ACTORS_SECRET" => String.duplicate("x", 43)
  }
  @config [hostname: "localhost", database: "groupher_server_dev", port: 5432]

  test "production, staging and non-Hub processes cannot enable fixtures" do
    assert {:ok, :pass} = Guard.check_environment(:dev, @variables, @config)
    assert {:error, _} = Guard.check_environment(:prod, @variables, @config)
    assert {:error, _} = Guard.check_environment(:test, @variables, @config)
    assert {:error, _} = Guard.check_environment(:dev, %{}, @config)

    for key <- ~w(NODE_ENV CLOUDFLARE_ENV ENVIRONMENT MIX_ENV),
        marker <- ~w(production staging preview) do
      assert {:error, _} =
               Guard.check_environment(:dev, Map.put(@variables, key, marker), @config)
    end
  end

  test "both configured and actual DB identity must be local development" do
    for config <- [
          Keyword.put(@config, :hostname, "db.example.com"),
          Keyword.put(@config, :database, "production"),
          Keyword.put(@config, :url, "postgres://remote/db")
        ] do
      assert {:error, _} = Guard.check_environment(:dev, @variables, config)
    end

    assert {:ok, :pass} = Guard.check_database(["groupher_server_dev", "127.0.0.1"])
    assert {:ok, :pass} = Guard.check_database(["groupher_server_dev", "::1/128"])
    assert {:error, _} = Guard.check_database(["production", "127.0.0.1"])
    assert {:error, _} = Guard.check_database(["groupher_server_dev", "10.0.0.1"])
  end

  test "production compilation excludes all fixture implementation files" do
    original = Mix.env()

    try do
      Mix.env(:prod)
      paths = GroupherServer.Mixfile.project()[:elixirc_paths]
      refute "dev" in paths
    after
      Mix.env(original)
    end
  end
end
