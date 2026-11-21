defmodule GroupherServer.Repo.Migrations.CreateArticlePublicBodies do
  use Ecto.Migration

  def up do
    execute("LOCK TABLE cms.article_publics IN ACCESS EXCLUSIVE MODE")

    execute("""
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM cms.article_publics) THEN
        RAISE EXCEPTION 'ArticlePublicBody cutover requires empty Public; no history migration';
      END IF;
    END $$
    """)

    create table(:article_public_bodies, primary_key: false, prefix: "cms") do
      add(:article_id, :uuid, primary_key: true)
      add(:snapshot_id, :uuid, null: false)
      add(:json, :text, null: false)
      add(:schema_version, :integer, null: false, default: 1)
      add(:markdown, :text, null: false)
      add(:html, :text, null: false)
      add(:markdown_toc, :map, null: false)
      add(:plain_text, :text, null: false)
      add(:thumbnail, :map, null: false)
      add(:xml, :text)
      add(:rss, :text)
      timestamps()
    end

    create(
      constraint(:article_public_bodies, :article_public_bodies_version_check,
        prefix: "cms",
        check: "schema_version > 0"
      )
    )

    create(unique_index(:article_public_bodies, [:article_id, :snapshot_id], prefix: "cms"))
    create(unique_index(:article_publics, [:article_id, :snapshot_id], prefix: "cms"))

    # Both halves must exist and agree at commit; a publisher can replace them
    # in either order inside a transaction. Public removal owns body deletion.
    execute("""
    ALTER TABLE cms.article_public_bodies
      ADD CONSTRAINT article_public_bodies_public_fkey
      FOREIGN KEY (article_id, snapshot_id)
      REFERENCES cms.article_publics(article_id, snapshot_id)
      ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED
    """)

    execute("""
    ALTER TABLE cms.article_publics
      ADD CONSTRAINT article_publics_body_fkey
      FOREIGN KEY (article_id, snapshot_id)
      REFERENCES cms.article_public_bodies(article_id, snapshot_id)
      DEFERRABLE INITIALLY DEFERRED
    """)
  end

  def down do
    raise "ArticlePublicBody cutover is irreversible; restore an approved empty baseline instead"
  end
end
