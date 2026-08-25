defmodule GroupherServer.Repo.Migrations.RemoveThreadEntities do
  use Ecto.Migration

  def up do
    drop_if_exists(index(:communities_threads, [:community_id, :thread_id], prefix: "cms"))
    drop_if_exists(table(:communities_threads, prefix: "cms"))

    drop_if_exists(index(:threads, [:inserted_at], prefix: "cms"))
    drop_if_exists(index(:threads, [:index], prefix: "cms"))
    drop_if_exists(index(:threads, [:title], prefix: "cms"))
    drop_if_exists(table(:threads, prefix: "cms"))
  end

  def down do
    raise Ecto.MigrationError, "remove_thread_entities migration is irreversible"
  end
end
