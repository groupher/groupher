Code.require_file("../../dev/seed/target.ex", __DIR__)

defmodule GroupherServer.LocalTestActorsGuardTest do
  use ExUnit.Case, async: false
  alias GroupherServer.Seed
  alias Seed.Target, as: Guard

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

  test "secondary fixture access requires its own marked development database" do
    database = "groupher_example_0123456789abcdef_dev"
    target = [hostname: "127.0.0.1", port: 5432, database: database]
    config = target

    marker = %{
      "namespace" => "groupher-devhub",
      "formatVersion" => 1,
      "worktreeId" => "0123456789abcdef",
      "purpose" => "dev",
      "previousComment" => nil
    }

    assert {:ok, :pass} = Guard.check_environment(:dev, @variables, config, target)
    assert {:error, _} = Guard.check_environment(:prod, @variables, config, target)
    assert {:error, _} = Guard.check_environment(:dev, @variables, @config, target)

    assert {:ok, :pass} =
             Guard.check_database([database, "127.0.0.1", 5432, Jason.encode!(marker)], target)

    assert {:error, _} = Guard.check_database([database, "127.0.0.1", 5432, nil], target)

    for changed <- [
          Map.put(marker, "purpose", "test"),
          Map.put(marker, "worktreeId", "ffffffffffffffff"),
          Map.put(marker, "formatVersion", 2),
          Map.put(marker, "run", "other")
        ] do
      assert {:error, _} =
               Guard.check_database([database, "127.0.0.1", 5432, Jason.encode!(changed)], target)
    end

    assert {:error, _} =
             Guard.check_database([database, "10.0.0.1", 5432, Jason.encode!(marker)], target)
  end
end
