defmodule GroupherServer.Repo.Migrations.RemoveThreadEntities do
  use Ecto.Migration

  def change do
    drop_if_exists(index(:communities_threads, [:community_id, :thread_id]))
    drop_if_exists(table(:communities_threads))

    drop_if_exists(index(:threads, [:inserted_at]))
    drop_if_exists(index(:threads, [:index]))
    drop_if_exists(index(:threads, [:title]))
    drop_if_exists(table(:threads))
  end
end
