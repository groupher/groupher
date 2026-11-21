alias GroupherServer.Accounts.Model.User
alias GroupherServer.CMS.Model.Community
alias GroupherServer.Repo

database = System.fetch_env!("TEST_DB_NAME")
target_migration = 20_261_117_090_000

unless Mix.env() == :test and String.starts_with?(database, "groupher_passport_ref_migration_") do
  raise "Run only against a dedicated groupher_passport_ref_migration_* database with MIX_ENV=test"
end

for app <- [:ecto_sql, :postgrex], do: Application.ensure_all_started(app)
Logger.configure(level: :warning)

config = Application.fetch_env!(:groupher_server, Repo)

unless Keyword.fetch!(config, :database) == database do
  raise "TEST_DB_NAME does not match the configured Repo database"
end

Application.put_env(
  :groupher_server,
  Repo,
  Keyword.put(config, :pool, DBConnection.ConnectionPool)
)

{:ok, _} = Repo.start_link()
[[^database]] = Repo.query!("SELECT current_database()").rows
[[nil]] = Repo.query!("SELECT to_regclass('public.schema_migrations')").rows

migrations = Path.expand("../priv/repo/migrations", __DIR__)
Ecto.Migrator.run(Repo, migrations, :up, to: target_migration - 1)

suffix = System.unique_integer([:positive])

{:ok, user} =
  %User{}
  |> User.changeset(%{
    login: "passport-ref-migration-#{suffix}",
    avatar: "https://example.test/avatar.png"
  })
  |> Repo.insert()

communities =
  for index <- 1..2 do
    slug = "passport-ref-#{suffix}-#{index}"
    now = DateTime.utc_now(:second)

    {1, nil} =
      Repo.insert_all(Community, [
        %{
          title: "Passport ref migration #{suffix}-#{index}",
          desc: "Legacy community without a ref",
          logo: "https://example.test/logo.png",
          slug: slug,
          user_id: user.id,
          inserted_at: now,
          updated_at: now
        }
      ])

    [[id]] = Repo.query!("SELECT id FROM cms.communities WHERE slug = $1", [slug]).rows
    %{id: id, slug: slug}
  end

Repo.query!("CREATE EXTENSION IF NOT EXISTS pgcrypto")

[[extension_schema]] =
  Repo.query!("""
  SELECT namespace.nspname
  FROM pg_catalog.pg_extension AS extension
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = extension.extnamespace
  WHERE extension.extname = 'pgcrypto'
  """).rows

quoted_extension_schema = "\"#{String.replace(extension_schema, "\"", "\"\"")}\""
sequence_name = "passport_ref_migration_bytes_#{suffix}"
quoted_sequence = "#{quoted_extension_schema}.\"#{sequence_name}\""
Repo.query!("CREATE SEQUENCE #{quoted_sequence}")

sequence_literal = "'#{quoted_sequence}'"

Repo.query!("""
CREATE OR REPLACE FUNCTION #{quoted_extension_schema}.gen_random_bytes(integer)
RETURNS bytea
LANGUAGE plpgsql
AS $passport_ref_migration_test$
DECLARE call_number bigint;
BEGIN
  call_number := nextval(#{sequence_literal}::regclass);
  IF call_number <= 2 THEN
    RETURN decode(repeat('a1', $1), 'hex');
  END IF;
  RETURN decode(repeat('b2', $1), 'hex');
END;
$passport_ref_migration_test$
""")

Ecto.Migrator.run(Repo, migrations, :up, to: target_migration)

[first_community, second_community] = communities

[[first_community_id, first_ref], [second_community_id, second_ref]] =
  Repo.query!(
    "SELECT id, ref FROM cms.communities WHERE id IN ($1, $2) ORDER BY id",
    [first_community.id, second_community.id]
  ).rows

unless first_community_id == first_community.id and second_community_id == second_community.id do
  raise "Expected the Community rows to retain insertion order"
end

unless first_ref == "cm_" <> String.duplicate("a1", 16) do
  raise "Expected first existing community to use the first deterministic candidate"
end

unless second_ref == "cm_" <> String.duplicate("b2", 16) do
  raise "Expected colliding candidate to be retried for the second community"
end

[[3]] = Repo.query!("SELECT last_value FROM #{quoted_sequence}").rows

[[0, 0]] =
  Repo.query!("""
  SELECT count(*) FILTER (WHERE ref IS NULL), count(*) - count(DISTINCT ref)
  FROM cms.communities
  """).rows

before_rerun = Repo.query!("SELECT id, ref FROM cms.communities ORDER BY id").rows
Repo.query!("SELECT cms.backfill_community_refs()")
Repo.query!("SELECT cms.backfill_community_refs()")
after_rerun = Repo.query!("SELECT id, ref FROM cms.communities ORDER BY id").rows

unless before_rerun == after_rerun do
  raise "Repeated Community ref backfill changed existing refs"
end

[[3]] = Repo.query!("SELECT last_value FROM #{quoted_sequence}").rows

[[renamed_ref]] =
  Repo.query!(
    "UPDATE cms.communities SET slug = slug || '-renamed' WHERE id = $1 RETURNING ref",
    [second_community.id]
  ).rows

unless renamed_ref == second_ref do
  raise "Changing a community slug changed its stable ref"
end

Repo.query!("ALTER TABLE cms.communities DISABLE TRIGGER communities_ref_guard")

try do
  Repo.query!("UPDATE cms.communities SET ref = $1 WHERE id = $2", [
    first_ref,
    second_community.id
  ])

  raise "Duplicate Community ref unexpectedly succeeded"
rescue
  error in Postgrex.Error ->
    unless error.postgres.code == :unique_violation and
             error.postgres.constraint == "communities_ref_index" do
      reraise(error, __STACKTRACE__)
    end
after
  Repo.query!("ALTER TABLE cms.communities ENABLE TRIGGER communities_ref_guard")
end

[[^first_ref], [^second_ref]] =
  Repo.query!(
    "SELECT ref FROM cms.communities WHERE id IN ($1, $2) ORDER BY id",
    [first_community.id, second_community.id]
  ).rows

IO.puts(
  "Community ref migration passed non-empty backfill, deterministic collision retry, duplicate constraint, idempotent rerun, and slug stability"
)
