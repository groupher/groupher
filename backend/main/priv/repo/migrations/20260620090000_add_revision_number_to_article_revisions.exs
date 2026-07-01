defmodule GroupherServer.Repo.Migrations.AddRevisionNumberToArticleSnapshots do
  use Ecto.Migration

  @prefix "cms"

  def up do
    alter table(:article_snapshots, prefix: @prefix) do
      add(:snapshot_number, :integer)
    end

    execute("""
    UPDATE "#{@prefix}"."article_snapshots" AS target
    SET snapshot_number = numbered.snapshot_number
    FROM (
      SELECT
        id,
        ROW_NUMBER() OVER (
          PARTITION BY community_id, thread, type, article_id, article_draft_id
          ORDER BY inserted_at ASC, id ASC
        ) AS snapshot_number
      FROM "#{@prefix}"."article_snapshots"
    ) AS numbered
    WHERE target.id = numbered.id;
    """)

    alter table(:article_snapshots, prefix: @prefix) do
      modify(:snapshot_number, :integer, null: false)
    end

    create(index(:article_snapshots, [:snapshot_number], prefix: @prefix))

    create(
      index(:article_snapshots, [:community_id, :thread, :type, :article_id, :snapshot_number],
        prefix: @prefix
      )
    )

    create(
      index(
        :article_snapshots,
        [:community_id, :thread, :type, :article_draft_id, :snapshot_number],
        prefix: @prefix
      )
    )
  end

  def down do
    drop(
      index(
        :article_snapshots,
        [:community_id, :thread, :type, :article_draft_id, :snapshot_number], prefix: @prefix)
    )

    drop(
      index(:article_snapshots, [:community_id, :thread, :type, :article_id, :snapshot_number],
        prefix: @prefix
      )
    )

    drop(index(:article_snapshots, [:snapshot_number], prefix: @prefix))

    alter table(:article_snapshots, prefix: @prefix) do
      remove(:snapshot_number)
    end
  end
end
