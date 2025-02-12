defmodule GroupherServer.Repo.Migrations.CreateIndexForCatState do
  use Ecto.Migration

  def change do
    create(unique_index(:cms_posts, [:cat, :state]))
    create(unique_index(:cms_posts, :state))
  end
end
