defmodule GroupherServer.Repo.Migrations.LinkArticlePublicToSnapshot do
  use Ecto.Migration

  @prefix "cms"

  def up do
    execute("ALTER TABLE cms.article_publics ALTER COLUMN revision_id DROP NOT NULL")
    execute("ALTER TABLE cms.article_publics ALTER COLUMN body_hash DROP NOT NULL")

    alter table(:article_publics, prefix: @prefix) do
      add(:snapshot_id, :uuid, null: false)
      add(:plain_text, :text, null: false)
    end

    create(index(:article_publics, [:snapshot_id], prefix: @prefix))

    execute(
      """
      ALTER TABLE cms.article_publics
      ADD CONSTRAINT article_publics_snapshot_owner_fkey
      FOREIGN KEY (article_id, snapshot_id)
      REFERENCES cms.article_snapshots(article_id, id) ON DELETE RESTRICT
      """,
      "ALTER TABLE cms.article_publics DROP CONSTRAINT article_publics_snapshot_owner_fkey"
    )

    execute(
      "ALTER TABLE cms.article_publics DROP CONSTRAINT article_publics_published_by_id_fkey",
      "ALTER TABLE cms.article_publics ADD CONSTRAINT article_publics_published_by_id_fkey " <>
        "FOREIGN KEY (published_by_id) REFERENCES cms.authors(id) ON DELETE SET NULL"
    )

    execute(
      "ALTER TABLE cms.article_publics ADD CONSTRAINT article_publics_published_by_user_fkey " <>
        "FOREIGN KEY (published_by_id) REFERENCES account.users(id) ON DELETE RESTRICT",
      "ALTER TABLE cms.article_publics DROP CONSTRAINT article_publics_published_by_user_fkey"
    )
  end

  def down do
    execute(
      "ALTER TABLE cms.article_publics DROP CONSTRAINT article_publics_published_by_user_fkey"
    )

    execute(
      "ALTER TABLE cms.article_publics ADD CONSTRAINT article_publics_published_by_id_fkey " <>
        "FOREIGN KEY (published_by_id) REFERENCES cms.authors(id) ON DELETE SET NULL"
    )

    execute("ALTER TABLE cms.article_publics DROP CONSTRAINT article_publics_snapshot_owner_fkey")
    drop(index(:article_publics, [:snapshot_id], prefix: @prefix))

    alter table(:article_publics, prefix: @prefix) do
      remove(:snapshot_id)
      remove(:plain_text)
    end

    execute("ALTER TABLE cms.article_publics ALTER COLUMN body_hash SET NOT NULL")
    execute("ALTER TABLE cms.article_publics ALTER COLUMN revision_id SET NOT NULL")
  end
end
