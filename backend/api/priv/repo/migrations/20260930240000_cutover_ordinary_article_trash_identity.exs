defmodule GroupherServer.Repo.Migrations.CutoverOrdinaryArticleTrashIdentity do
  use Ecto.Migration

  @moduledoc "Rebuilds ordinary Trash membership on stable Article UUID identity."

  def up do
    execute("TRUNCATE TABLE cms.trashed_articles CASCADE")

    drop_if_exists(
      index(:trashed_articles, [:community_id, :thread, :article_hash_id],
        prefix: "cms",
        name: :trashed_articles_logical_article_index
      )
    )

    alter table(:trashed_articles, prefix: "cms") do
      remove(:article_hash_id)

      add(
        :article_id,
        references(:articles, type: :uuid, prefix: "cms", on_delete: :delete_all),
        null: false
      )
    end

    create(
      unique_index(:trashed_articles, [:article_id],
        prefix: "cms",
        name: :trashed_articles_stable_article_index
      )
    )
  end

  def down do
    drop_if_exists(
      index(:trashed_articles, [:article_id],
        prefix: "cms",
        name: :trashed_articles_stable_article_index
      )
    )

    execute("TRUNCATE TABLE cms.trashed_articles CASCADE")

    alter table(:trashed_articles, prefix: "cms") do
      remove(:article_id)
      add(:article_hash_id, :uuid, null: false)
    end
  end
end
