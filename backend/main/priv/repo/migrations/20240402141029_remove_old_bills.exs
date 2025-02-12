defmodule GroupherServer.Repo.Migrations.RemoveOldBills do
  use Ecto.Migration

  def change do
    drop table(:users_bills)
    drop table(:bills)
  end
end
