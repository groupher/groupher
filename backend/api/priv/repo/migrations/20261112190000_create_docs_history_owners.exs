defmodule GroupherServer.Repo.Migrations.CreateDocsHistoryOwners do
  use Ecto.Migration

  def change do
    execute(
      """
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM cms.articles WHERE thread = 'doc') THEN
          RAISE EXCEPTION 'R6 requires an empty Doc aggregate; history ownership is not backfilled';
        END IF;
      END $$;
      """,
      "SELECT 1"
    )

    create table(:docs_history_owners, prefix: "cms", primary_key: false) do
      add(:article_id, references(:articles, prefix: "cms", type: :uuid, on_delete: :restrict),
        primary_key: true
      )

      add(:community_id, references(:communities, prefix: "cms", on_delete: :restrict),
        null: false
      )
    end

    create(index(:docs_history_owners, [:community_id, :article_id], prefix: "cms"))
  end
end
