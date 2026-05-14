defmodule GroupherServer.Repo.Migrations.RemoveRoleFromCommunityModerators do
  use Ecto.Migration

  def change do
    alter(table(:communities_moderators, prefix: "cms")) do
      remove(:role, :string)
    end
  end
end
