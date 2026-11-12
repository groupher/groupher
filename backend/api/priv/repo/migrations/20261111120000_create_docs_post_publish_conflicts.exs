defmodule GroupherServer.Repo.Migrations.CreateDocsPostPublishConflicts do
  use Ecto.Migration

  @prefix "cms"

  def change do
    create table(:docs_post_publish_conflicts, primary_key: false, prefix: @prefix) do
      add(:community_id, references(:communities, prefix: @prefix, on_delete: :restrict),
        primary_key: true
      )

      add(:article_id, references(:articles, type: :uuid, prefix: @prefix, on_delete: :restrict),
        primary_key: true
      )

      add(:base_snapshot_id, :uuid, null: false)
      add(:published_snapshot_id, :uuid, null: false)
      add(:default_revision, :bigint, null: false)
      timestamps()
    end

    create(index(:docs_post_publish_conflicts, [:base_snapshot_id], prefix: @prefix))
    create(index(:docs_post_publish_conflicts, [:published_snapshot_id], prefix: @prefix))

    create(
      constraint(:docs_post_publish_conflicts, :docs_post_publish_conflicts_revision_check,
        check: "default_revision > 0",
        prefix: @prefix
      )
    )

    for {column, name} <- [
          {:base_snapshot_id, :docs_post_publish_conflicts_base_owner_fkey},
          {:published_snapshot_id, :docs_post_publish_conflicts_public_owner_fkey}
        ] do
      execute(
        "ALTER TABLE cms.docs_post_publish_conflicts ADD CONSTRAINT #{name} " <>
          "FOREIGN KEY (article_id, #{column}) REFERENCES " <>
          "cms.article_snapshots(article_id, id) ON DELETE RESTRICT",
        "ALTER TABLE cms.docs_post_publish_conflicts DROP CONSTRAINT #{name}"
      )
    end
  end
end
