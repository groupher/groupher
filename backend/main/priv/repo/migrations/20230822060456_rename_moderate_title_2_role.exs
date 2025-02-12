defmodule GroupherServer.Repo.Migrations.RenameModerateTitle2Role do
  use Ecto.Migration

  def change do
    rename(table(:communities_moderators), :title, to: :role)
  end
end
