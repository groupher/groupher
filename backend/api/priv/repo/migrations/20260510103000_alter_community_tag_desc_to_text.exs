defmodule GroupherServer.Repo.Migrations.AlterCommunityTagDescToText do
  use Ecto.Migration

  def change do
    alter table(:community_tags, prefix: "cms") do
      modify(:desc, :text, from: :string)
    end
  end
end
