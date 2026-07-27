defmodule GroupherServer.Repo.Migrations.AddPublicRefToCommunityAssets do
  use Ecto.Migration

  @prefix "cms"

  def change do
    alter table(:community_assets, prefix: @prefix) do
      add(:public_ref, :string)
    end

    create(
      unique_index(:community_assets, [:public_ref],
        prefix: @prefix,
        where: "public_ref IS NOT NULL",
        name: :community_assets_public_ref_index
      )
    )
  end
end
