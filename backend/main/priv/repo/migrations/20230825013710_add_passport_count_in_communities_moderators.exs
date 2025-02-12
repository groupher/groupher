defmodule GroupherServer.Repo.Migrations.AddPassportCountInCommunitiesModerators do
  use Ecto.Migration

  def change do
    alter(table(:communities_moderators)) do
      add(:passport_item_count, :integer, default: 0)
    end
  end
end
