defmodule GroupherServer.Repo.Migrations.RenameAliasToNameAlias do
  use Ecto.Migration

  def change do
    rename(table(:community_dashboards), :alias, to: :name_alias)
  end
end
