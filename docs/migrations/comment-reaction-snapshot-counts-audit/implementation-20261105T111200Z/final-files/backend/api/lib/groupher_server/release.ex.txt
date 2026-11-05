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
  @legacy_mentions_migration 20_261_105_110_000

  def migrate do
    load_app()

    for repo <- repos() do
      {:ok, _, _} =
        Ecto.Migrator.with_repo(repo, fn connected_repo ->
          verify_migration_database!(connected_repo)
          verify_shared_comments_before_ddl!(connected_repo)

          verify_mentions_cutover!(
            System.get_env("MIGRATION_EXPECTED_DATABASE"),
            Ecto.Migrator.migrations(connected_repo)
          )

          Ecto.Migrator.run(connected_repo, :up, all: true)

          if Application.get_env(@app, :env) == :prod do
            GroupherServer.CMS.comments_schema_generation_mark_ready!(
              connected_repo,
              GroupherServer.CMS.comments_schema_generation_environment()
            )
          end
        end)
    end
  end

  @doc "Attests an empty database; requires explicit deployment manifest coordinates."
  def bootstrap_shared_comments do
    load_app()

    for repo <- repos() do
      Ecto.Migrator.with_repo(repo, fn connected_repo ->
        verify_migration_database!(connected_repo)

        GroupherServer.CMS.comments_schema_generation_bootstrap!(
          connected_repo,
          System.fetch_env!("MIGRATION_EXPECTED_DATABASE"),
          System.fetch_env!("SHARED_COMMENTS_GENERATION"),
          System.fetch_env!("SHARED_COMMENTS_BOOTSTRAP_SOURCE"),
          System.fetch_env!("SHARED_COMMENTS_BUILD")
        )
      end)
    end
  end

  defp verify_shared_comments_before_ddl!(repo) do
    if Application.get_env(@app, :env) == :prod do
      GroupherServer.CMS.comments_schema_generation_verify_before_migration!(
        repo,
        GroupherServer.CMS.comments_schema_generation_environment()
      )
    end

    {:ok, :verified}
  end

  @doc "Refuses production migration before any DDL unless the actual database matches the execution record."
  def verify_migration_database!(repo) do
    expected = System.get_env("MIGRATION_EXPECTED_DATABASE")

    if Application.get_env(@app, :env) == :prod and expected in [nil, ""] do
      raise "MIGRATION_EXPECTED_DATABASE is required for production migration"
    end

    if expected not in [nil, ""] do
      actual = database_identity!(repo)

      if actual != expected do
        raise "migration database mismatch: expected #{expected}, connected to #{actual}"
      end
    end

    {:ok, :verified}
  end

  @doc "Returns the database name reported by the current Repo connection."
  def database_identity!(repo) do
    [[database]] = repo.query!("SELECT current_database()", []).rows
    database
  end

  @doc "Requires an exact production confirmation before dropping legacy Mention tables."
  def verify_mentions_cutover!(
        expected_database,
        migrations,
        runtime_env \\ Application.get_env(@app, :env)
      )

  def verify_mentions_cutover!(expected_database, migrations, :prod)
      when is_binary(expected_database) and is_list(migrations) do
    pending? =
      Enum.any?(migrations, fn
        {:down, @legacy_mentions_migration, _name} -> true
        _ -> false
      end)

    if pending? do
      expected_confirmation = "drop-legacy-mentions:#{expected_database}:writers-drained"

      if System.get_env("MENTIONS_GRAPH_CUTOVER_CONFIRMATION") != expected_confirmation do
        raise "MENTIONS_GRAPH_CUTOVER_CONFIRMATION must equal #{expected_confirmation}"
      end
    end

    {:ok, :verified}
  end

  def verify_mentions_cutover!(_expected_database, _migrations, _runtime_env) do
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
