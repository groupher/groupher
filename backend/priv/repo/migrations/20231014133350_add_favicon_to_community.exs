defmodule GroupherServer.Repo.Migrations.AddFaviconToCommunity do
  use Ecto.Migration

  def change do
    alter table(:communities) do
      add(:favicon, :string)
    end
  end
end
