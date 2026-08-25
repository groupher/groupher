defmodule GroupherServer.Repo.Migrations.AddRootToCommunity do
  use Ecto.Migration

  def change do
    create table(:community_root_users) do
      add(:user_id, references(:users, on_delete: :delete_all), null: false)
      add(:community_id, references(:communities, on_delete: :delete_all), null: false)

      timestamps()
    end

    create(unique_index(:community_root_users, [:user_id]))
  end
end
