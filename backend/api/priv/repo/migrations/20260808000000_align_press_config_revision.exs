defmodule GroupherServer.Repo.Migrations.AlignPressConfigRevisionType do
  use Ecto.Migration

  def up do
    alter table(:press_configs, prefix: "cms") do
      modify(:revision, :integer, null: false, default: 1)
    end
  end

  def down do
    alter table(:press_configs, prefix: "cms") do
      modify(:revision, :bigint, null: false, default: 1)
    end
  end
end
