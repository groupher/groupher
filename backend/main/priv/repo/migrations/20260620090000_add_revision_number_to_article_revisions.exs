defmodule GroupherServer.Repo.Migrations.AddRevisionNumberToArticleRevisions do
  use Ecto.Migration

  @prefix "cms"

  def up do
    alter table(:article_revisions, prefix: @prefix) do
      add(:revision_number, :integer)
    end

    execute("""
    UPDATE "#{@prefix}"."article_revisions" AS target
    SET revision_number = numbered.revision_number
    FROM (
      SELECT
        id,
        ROW_NUMBER() OVER (
          PARTITION BY community_id, thread, type, article_id, article_draft_id
          ORDER BY inserted_at ASC, id ASC
        ) AS revision_number
      FROM "#{@prefix}"."article_revisions"
    ) AS numbered
    WHERE target.id = numbered.id;
    """)

    alter table(:article_revisions, prefix: @prefix) do
      modify(:revision_number, :integer, null: false)
    end

    create(index(:article_revisions, [:revision_number], prefix: @prefix))

    create(
      index(:article_revisions, [:community_id, :thread, :type, :article_id, :revision_number],
        prefix: @prefix
      )
    )

    create(
      index(
        :article_revisions,
        [:community_id, :thread, :type, :article_draft_id, :revision_number],
        prefix: @prefix
      )
    )
  end

  def down do
    drop(
      index(
        :article_revisions,
        [:community_id, :thread, :type, :article_draft_id, :revision_number], prefix: @prefix)
    )

    drop(
      index(:article_revisions, [:community_id, :thread, :type, :article_id, :revision_number],
        prefix: @prefix
      )
    )

    drop(index(:article_revisions, [:revision_number], prefix: @prefix))

    alter table(:article_revisions, prefix: @prefix) do
      remove(:revision_number)
    end
  end
end
