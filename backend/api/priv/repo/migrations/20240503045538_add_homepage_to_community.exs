defmodule GroupherServer.Repo.Migrations.AddHomepageToCommunity do
  use Ecto.Migration

  def change do
    alter table(:communities, prefix: "cms") do
      add(:homepage, :string)
    end
  end
end
