defmodule GroupherServer.Repo.Migrations.CleanUpOldTables do
  use Ecto.Migration

  def change do
    drop_if_exists table("cms_repos_builders")
  end
end
