defmodule GroupherServer.ReleaseTest do
  use GroupherServer.TestMate, async: false
  alias GroupherServer.{Repo, Release}

  setup do
    expected = System.get_env("MIGRATION_EXPECTED_DATABASE")
    environment = Application.get_env(:groupher_server, :env)

    on_exit(fn ->
      if expected do
        System.put_env("MIGRATION_EXPECTED_DATABASE", expected)
      else
        System.delete_env("MIGRATION_EXPECTED_DATABASE")
      end

      Application.put_env(:groupher_server, :env, environment)
    end)

    %{database: Repo.query!("SELECT current_database()", []).rows |> hd() |> hd()}
  end

  test "production migration refuses a missing database expectation before DDL" do
    Application.put_env(:groupher_server, :env, :prod)
    System.delete_env("MIGRATION_EXPECTED_DATABASE")

    assert_raise RuntimeError, ~r/MIGRATION_EXPECTED_DATABASE is required/, fn ->
      Release.migrate()
    end
  end

  test "production migration refuses a mismatched real connection", %{database: database} do
    Application.put_env(:groupher_server, :env, :prod)
    System.put_env("MIGRATION_EXPECTED_DATABASE", database <> "_wrong")
    before = Repo.query!("SELECT version FROM schema_migrations ORDER BY version").rows

    assert_raise RuntimeError, ~r/migration database mismatch/, fn -> Release.migrate() end
    assert Repo.query!("SELECT version FROM schema_migrations ORDER BY version").rows == before

    System.put_env("MIGRATION_EXPECTED_DATABASE", database)
    assert {:ok, :verified} = Release.verify_migration_database!(Repo)
  end
end
