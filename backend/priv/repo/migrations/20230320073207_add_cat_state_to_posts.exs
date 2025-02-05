defmodule GroupherServer.Repo.Migrations.AddCatStateToPosts do
  use Ecto.Migration

  def change do
    alter table(:cms_posts) do
      add(:cat, :string)
      add(:state, :string)
    end
  end
end
