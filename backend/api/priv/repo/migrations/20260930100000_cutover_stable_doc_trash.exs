defmodule GroupherServer.Repo.Migrations.CutoverStableDocTrash do
  use Ecto.Migration

  @prefix "cms"

  @doc "Adds stable Article identity to branch-local Doc Trash membership."
  def change do
    alter table(:trashed_doc_articles, prefix: @prefix) do
      modify(:article_hash_id, :uuid, null: true, from: {:uuid, null: false})

      add(
        :article_id,
        references(:articles, type: :uuid, prefix: @prefix, on_delete: :delete_all)
      )
    end

    create(
      unique_index(:trashed_doc_articles, [:article_id, :branch_id],
        prefix: @prefix,
        where: "article_id IS NOT NULL",
        name: :trashed_doc_articles_article_branch_index
      )
    )
  end
end
