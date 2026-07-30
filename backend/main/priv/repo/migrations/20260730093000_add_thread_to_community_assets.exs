defmodule GroupherServer.Repo.Migrations.AddThreadToCommunityAssets do
  use Ecto.Migration

  @prefix "cms"

  def change do
    alter table(:community_assets, prefix: @prefix) do
      add(:thread, :string)
    end

    create(
      index(:community_assets, [:community_id, :thread, :status, :inserted_at, :id],
        prefix: @prefix,
        where: "deleted_at IS NULL",
        name: :community_assets_thread_page_index
      )
    )
  end
end
