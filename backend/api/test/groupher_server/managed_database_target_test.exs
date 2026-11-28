defmodule GroupherServer.ManagedDatabaseTargetTest do
  use ExUnit.Case, async: false

  alias GroupherServer.Repo

  test "repository rejects connection options that differ from the managed target" do
    previous = Application.get_env(:groupher_server, :managed_database_target)
    on_exit(fn -> Application.put_env(:groupher_server, :managed_database_target, previous) end)

    target = [
      database: "groupher_b_test",
      hostname: "127.0.0.1",
      port: 5432,
      username: "postgres"
    ]

    Application.put_env(:groupher_server, :managed_database_target, target)

    assert {:ok, ^target} = Repo.init(:runtime, target)

    assert_raise RuntimeError, ~r/conflict/, fn ->
      Repo.init(:runtime, Keyword.put(target, :database, "groupher_server_test"))
    end

    assert_raise RuntimeError, ~r/conflict/, fn ->
      Repo.init(:runtime, Keyword.put(target, :url, "postgres://example.com/other"))
    end
  end

  test "verified migration target cannot be replaced by later repository config" do
    previous =
      for key <-
            ~w(GROUPHER_MANAGED_MIGRATION_DATABASE GROUPHER_MANAGED_MIGRATION_HOST GROUPHER_MANAGED_MIGRATION_PORT),
          into: %{},
          do: {key, System.get_env(key)}

    previous_env = Application.get_env(:groupher_server, :env)

    on_exit(fn ->
      Application.put_env(:groupher_server, :env, previous_env)

      Enum.each(previous, fn {key, value} ->
        if value, do: System.put_env(key, value), else: System.delete_env(key)
      end)
    end)

    Application.put_env(:groupher_server, :env, :dev)
    System.put_env("GROUPHER_MANAGED_MIGRATION_DATABASE", "groupher_server_dev")
    System.put_env("GROUPHER_MANAGED_MIGRATION_HOST", "127.0.0.1")
    System.put_env("GROUPHER_MANAGED_MIGRATION_PORT", "5432")
    options = [database: "groupher_server_dev", hostname: "127.0.0.1", port: 5432]
    assert {:ok, ^options} = Repo.init(:runtime, options)

    assert_raise RuntimeError, ~r/verified migration target/, fn ->
      Repo.init(:runtime, Keyword.put(options, :hostname, "db.example.com"))
    end
  end
end
