defmodule GroupherServer.Repo.Migrations.AddLocaleToCommunity do
  use Ecto.Migration

  def change do
    alter table(:communities, prefix: "cms") do
      add(:locale, :string)
    end
  end
end
