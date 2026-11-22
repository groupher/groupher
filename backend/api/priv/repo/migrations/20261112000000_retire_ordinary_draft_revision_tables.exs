defmodule GroupherServer.Repo.Migrations.RetireOrdinaryDraftRevisionTables do
  use Ecto.Migration

  @tables ~w(article_drafts post_drafts blog_drafts changelog_drafts post_revisions blog_revisions changelog_revisions post_draft_tags blog_draft_tags changelog_draft_tags post_revision_tags blog_revision_tags changelog_revision_tags)

  def up do
    names = Enum.map_join(@tables, ", ", &"cms.#{&1}")
    execute("LOCK TABLE #{names} IN ACCESS EXCLUSIVE MODE")
    execute("LOCK TABLE cms.articles IN SHARE MODE")
    execute("LOCK TABLE cms.article_revisions IN SHARE MODE")

    execute("""
    DO $$
    DECLARE
      old_table text;
      has_rows boolean;
    BEGIN
      FOREACH old_table IN ARRAY ARRAY[#{Enum.map_join(@tables, ", ", &"'#{&1}'")}] LOOP
        EXECUTE format('SELECT EXISTS (SELECT 1 FROM cms.%I)', old_table) INTO has_rows;
        IF has_rows THEN
          RAISE EXCEPTION 'legacy ordinary Article table cms.% is not empty', old_table;
        END IF;
      END LOOP;
      IF EXISTS (
        SELECT 1 FROM cms.article_revisions revision
        JOIN cms.articles article ON article.id = revision.article_id
        WHERE article.thread <> 'doc'
      ) THEN
        RAISE EXCEPTION 'legacy ordinary Article revisions remain';
      END IF;
    END $$
    """)

    Enum.each(@tables, &execute("DROP TABLE cms.#{&1}"))
  end

  def down do
    raise "Retiring legacy ordinary Article tables is irreversible"
  end
end
