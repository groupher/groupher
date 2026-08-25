defmodule GroupherServer.Repo.Migrations.DropCitedArtiments do
  use Ecto.Migration

  @prefix "cms"

  def change do
    drop_if_exists(table(:cited_artiments, prefix: @prefix))
  end
end
