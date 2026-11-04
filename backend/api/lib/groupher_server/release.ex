defmodule GroupherServer.Release do
  @moduledoc """
  Used for executing DB release tasks when run in production without Mix
  installed.

  Business position:

      Application caller
        -> Release
        -> domain / infrastructure boundary
  """
  @app :groupher_server

  def migrate do
    load_app()

    for repo <- repos() do
      {:ok, _, _} =
        Ecto.Migrator.with_repo(repo, fn connected_repo ->
          verify_migration_database!(connected_repo)
          Ecto.Migrator.run(connected_repo, :up, all: true)
        end)
    end
  end

  @doc "Refuses production migration before any DDL unless the actual database matches the execution record."
  def verify_migration_database!(repo) do
    expected = System.get_env("MIGRATION_EXPECTED_DATABASE")

    if Application.get_env(@app, :env) == :prod and expected in [nil, ""] do
      raise "MIGRATION_EXPECTED_DATABASE is required for production migration"
    end

    if expected not in [nil, ""] do
      [[actual]] = repo.query!("SELECT current_database()", []).rows

      if actual != expected do
        raise "migration database mismatch: expected #{expected}, connected to #{actual}"
      end
    end

    {:ok, :verified}
  end

  def rollback(repo, version) do
    load_app()
    {:ok, _, _} = Ecto.Migrator.with_repo(repo, &Ecto.Migrator.run(&1, :down, to: version))
  end

  defp repos do
    Application.fetch_env!(@app, :ecto_repos)
  end

  defp load_app do
    Application.load(@app)
  end
end
