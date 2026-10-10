defmodule GroupherServer.Repo.Migrations.DropArticleInnerIdCounter do
  use Ecto.Migration

  @prefix "cms"

  def change do
    drop_if_exists(table(:article_inner_id_counters, prefix: @prefix))

    drop_if_exists(
      index(:articles, [:community_id, :thread, :inner_id],
        prefix: @prefix,
        name: :articles_public_inner_id_index
      )
    )
  end
end
