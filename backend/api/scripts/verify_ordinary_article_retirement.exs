# Run only against a disposable TEST_DB_NAME starting with groupher_article_retire_.
# Migrate that database through 20261111120000 before running this script.
alias GroupherServer.{CMS, Repo}
alias CMS.Model.{ArticleBodySnapshot, ArticleRevision, DocPublic}

database = System.get_env("TEST_DB_NAME", "")

unless Mix.env() == :test and String.starts_with?(database, "groupher_article_retire_") do
  raise "This verification requires a disposable groupher_article_retire_ test database"
end

{_, post, _, _} = GroupherServer.Support.Factory.mock_article(:post)
{_, doc, _, _} = GroupherServer.Support.Factory.mock_article(:doc)
doc_public = Repo.get_by!(DocPublic, article_id: doc.id)

Code.require_file(
  "../priv/repo/migrations/20261112000000_retire_ordinary_draft_revision_tables.exs",
  __DIR__
)

mod = GroupherServer.Repo.Migrations.RetireOrdinaryDraftRevisionTables
version = 20_261_112_000_000

Repo.query!(
  "INSERT INTO cms.post_drafts (article_id, inserted_at, updated_at) VALUES ($1, now(), now())",
  [Ecto.UUID.dump!(post.id)]
)

try do
  Ecto.Migrator.up(Repo, version, mod, log: false)
  raise "nonempty table guard did not fire"
rescue
  e in Postgrex.Error ->
    unless String.contains?(Exception.message(e), "legacy ordinary Article table"),
      do: reraise(e, __STACKTRACE__)
end

Repo.query!("DELETE FROM cms.post_drafts")

body =
  %ArticleBodySnapshot{}
  |> ArticleBodySnapshot.changeset(%{json: "[]", body_hash: "legacy-probe", schema_version: 1})
  |> Repo.insert!()

revision =
  %ArticleRevision{}
  |> ArticleRevision.changeset(%{
    article_id: post.id,
    body_snapshot_id: body.id,
    title: "legacy",
    digest: "legacy",
    content_hash: "legacy-probe",
    schema_version: 1,
    cleanup_after: DateTime.utc_now(:second)
  })
  |> Repo.insert!()

try do
  Ecto.Migrator.up(Repo, version, mod, log: false)
  raise "legacy revision guard did not fire"
rescue
  e in Postgrex.Error ->
    unless String.contains?(Exception.message(e), "legacy ordinary Article revisions remain"),
      do: reraise(e, __STACKTRACE__)
end

Repo.delete!(revision)

Repo.query!(
  "CREATE TABLE public.article_retire_fk_probe (article_id uuid REFERENCES cms.article_drafts(article_id))"
)

try do
  Ecto.Migrator.up(Repo, version, mod, log: false)
  raise "inbound foreign key guard did not fire"
rescue
  e in Postgrex.Error ->
    if e.postgres.code != :dependent_objects_still_exist, do: reraise(e, __STACKTRACE__)
    %{rows: [[table]]} = Repo.query!("SELECT to_regclass($1)::text", ["cms.post_drafts"])
    true = is_binary(table)
end

Repo.query!("DROP TABLE public.article_retire_fk_probe")
:ok = Ecto.Migrator.up(Repo, version, mod, log: false)
%{rows: [[nil]]} = Repo.query!("SELECT to_regclass($1)", ["cms.article_drafts"])
^doc_public = Repo.get_by!(DocPublic, article_id: doc.id)
IO.puts("Ordinary Article retirement guards and Docs preservation passed")
