defmodule GroupherServer.Repo.Migrations.RenameCommunityCatetory do
  use Ecto.Migration

  def change do
    rename(table("communities_categories", prefix: "cms"), to: table("communities_join_categories", prefix: "cms"))
  end
end
