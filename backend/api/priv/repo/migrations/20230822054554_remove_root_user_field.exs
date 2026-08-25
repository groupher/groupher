defmodule GroupherServer.Repo.Migrations.RemoveRootUserField do
  use Ecto.Migration

  def change do
    drop(table(:community_root_users))
  end
end
