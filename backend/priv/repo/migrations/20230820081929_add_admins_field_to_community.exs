defmodule GroupherServer.Repo.Migrations.AddAdminsFieldToCommunity do
  use Ecto.Migration

  def change do
    alter table(:communities) do
      add(:admins, :map)
    end
  end
end
