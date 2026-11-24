defmodule Mix.Tasks.Docs.PublicRead.Report do
  @moduledoc """
  Prints Doc public projection integrity and count refresh candidates without repairing them.

      operator -> explicit database environment -> PublicReadReport -> JSON / inspected report

  Only Repo dependencies are started, not the application/Endpoint/Oban tree.
  MIX_ENV=prod is rejected; use an explicitly configured isolated copy/replica.
  Output includes the connected database and highest migration version.
  The task never rebuilds bodies, updates counters, purges caches or migrates
  the target database. Missing schema must be resolved outside this report.
  """

  use Mix.Task

  alias GroupherServer.{CMS, Repo}
  alias CMS.Articles.Query.PublicReadReport

  @shortdoc "Report Doc public projection integrity and stale counts (no repairs)"

  @impl true
  @doc "Prints the Doc public-projection integrity report without modifying the selected database."
  def run(args) do
    {opts, rest, invalid} = OptionParser.parse(args, strict: [json: :boolean])
    if rest != [] or invalid != [], do: Mix.raise("Usage: mix docs.public_read.report [--json]")

    if Mix.env() == :prod do
      Mix.raise(
        "docs.public_read.report refuses MIX_ENV=prod; configure an isolated copy or replica"
      )
    end

    Mix.Task.run("app.config")

    {:ok, report, _started} =
      Ecto.Migrator.with_repo(Repo, fn repo ->
        %{rows: [[database, migration_version]]} =
          Ecto.Adapters.SQL.query!(
            repo,
            "SELECT current_database(), (SELECT max(version) FROM public.schema_migrations)",
            [],
            log: false
          )

        started_at = System.monotonic_time(:millisecond)
        {:ok, report} = PublicReadReport.report()

        report
        |> Map.put(:target, %{database: database, migration_version: migration_version})
        |> Map.put(:elapsed_ms, System.monotonic_time(:millisecond) - started_at)
      end)

    output =
      if opts[:json],
        do: Jason.encode!(report),
        else: inspect(report, pretty: true, limit: :infinity)

    Mix.shell().info(output)
  end
end
