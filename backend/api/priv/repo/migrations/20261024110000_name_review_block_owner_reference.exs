defmodule GroupherServer.Repo.Migrations.NameReviewBlockOwnerReference do
  use Ecto.Migration

  @cms "cms"

  def up do
    for table <- ~w(article_review_blocks comment_review_blocks doc_review_blocks) do
      execute("ALTER TABLE #{@cms}.#{table} RENAME COLUMN request_id TO artiment_review_id")

      execute(
        "ALTER TABLE #{@cms}.#{table} RENAME CONSTRAINT #{String.replace(table, "_blocks", "_restrictions")}_request_id_fkey TO #{table}_artiment_review_id_fkey"
      )
    end
  end

  def down do
    raise "Review block owner reference is not reverted"
  end
end
