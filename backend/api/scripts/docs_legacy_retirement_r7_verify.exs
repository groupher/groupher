# Fresh disposable database only; runs without starting application workers.
alias GroupherServer.Repo

database = System.fetch_env!("TEST_DB_NAME")

unless Mix.env() == :test and String.starts_with?(database, "groupher_docs_r7_guard_") do
  raise "A fresh groupher_docs_r7_guard_* database is required"
end

for app <- [:ecto_sql, :postgrex], do: Application.ensure_all_started(app)
config = Application.fetch_env!(:groupher_server, Repo)

Application.put_env(
  :groupher_server,
  Repo,
  Keyword.put(config, :pool, DBConnection.ConnectionPool)
)

{:ok, _} = Repo.start_link()
[[^database]] = Repo.query!("SELECT current_database()").rows
[[nil]] = Repo.query!("SELECT to_regclass('public.schema_migrations')").rows
migrations = Path.expand("../priv/repo/migrations", __DIR__)
Ecto.Migrator.run(Repo, migrations, :up, to: 20_261_112_200_000)

Repo.query!("""
INSERT INTO cms.article_body_snapshots(id,json,body_hash,schema_version,inserted_at)
VALUES(gen_random_uuid(),'[]','retirement-guard-probe',1,now())
""")

try do
  Ecto.Migrator.run(Repo, migrations, :up, all: true)
  raise "R7 accepted nonempty historical content"
rescue
  error in Postgrex.Error ->
    unless String.contains?(Exception.message(error), "R7 requires cleared legacy table") do
      reraise(error, __STACKTRACE__)
    end
end

[[false, true]] =
  Repo.query!("""
  SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version=20261112210000),
         to_regclass('cms.doc_branches') IS NOT NULL
  """).rows

Repo.query!("DELETE FROM cms.article_body_snapshots WHERE body_hash='retirement-guard-probe'")
Ecto.Migrator.run(Repo, migrations, :up, all: true)
[[nil]] = Repo.query!("SELECT to_regclass('cms.doc_branches')").rows
GroupherServer.CMS.Comments.SchemaGeneration.schema_fingerprint!(Repo)
IO.puts("R7 nonempty legacy rejection, rollback and cleared fresh migration passed")
