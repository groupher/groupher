defmodule GroupherServer.Repo.Migrations.FixIndexForCatState do
  use Ecto.Migration

  def change do
    drop(unique_index(:cms_posts, [:cat, :state]))
    drop(unique_index(:cms_posts, :state))

    create(index(:cms_posts, [:cat, :state]))
    create(index(:cms_posts, :state))
    create(index(:cms_posts, :cat))
  end
end
