# Run with MIX_ENV=test mix run --no-start scripts/docs_r8_migrate.exs.
# This operational entry migrates an already-cleared R8 database, never converts content.
alias GroupherServer.{CMS, Repo}

connection_file = System.fetch_env!("R8_CONNECTION_FILE")
url = connection_file |> File.read!() |> String.trim()
uri = URI.parse(url)
expected_host = System.fetch_env!("R8_EXPECTED_HOST")
expected_database = System.fetch_env!("R8_EXPECTED_DATABASE")

unless uri.host == expected_host and uri.path == "/" <> expected_database do
  raise "R8 connection does not match the explicit deployment target"
end

for app <- [:ssl, :ecto_sql, :postgrex], do: Application.ensure_all_started(app)

config =
  Application.fetch_env!(:groupher_server, Repo)
  |> Keyword.drop([:username, :password, :database, :hostname, :port, :pool])
  |> Keyword.merge(
    url: url,
    pool: DBConnection.ConnectionPool,
    pool_size: 2,
    connect_timeout: 30_000,
    queue_target: 30_000,
    pool_timeout: 60_000,
    ssl: [
      verify: :verify_peer,
      cacerts: :public_key.cacerts_get(),
      server_name_indication: String.to_charlist(expected_host),
      customize_hostname_check: [match_fun: :public_key.pkix_verify_hostname_match_fun(:https)]
    ]
  )

Application.put_env(:groupher_server, Repo, config)
{:ok, _} = Repo.start_link()

[[^expected_database, 0]] =
  Repo.query!("SELECT current_database(),count(*) FROM cms.articles").rows

versions =
  Ecto.Migrator.run(Repo, Path.expand("../priv/repo/migrations", __DIR__), :up, all: true)

hash = CMS.Comments.SchemaGeneration.schema_fingerprint!(Repo)

case System.get_env("R8_APPROVED_SCHEMA_SHA256") do
  nil ->
    :ok

  approved ->
    unless hash == approved, do: raise("R8 migrated schema differs from approved rehearsal")

    {:ok, _} =
      CMS.Comments.SchemaGeneration.mark_ready!(Repo,
        database: expected_database,
        generation: System.fetch_env!("R8_EXPECTED_GENERATION"),
        schema_sha256: approved
      )
end

result = %{
  database: expected_database,
  host: expected_host,
  migrations_applied: versions,
  schema_sha256: hash,
  remaining_articles: Repo.aggregate(CMS.Model.Article, :count)
}

File.write!(System.fetch_env!("R8_EVIDENCE_FILE"), Jason.encode!(result, pretty: true))
IO.puts("R8 migration completed; explicit target and empty-content checks passed")
