defmodule GroupherServer.Repo.Migrations.RenameCommunityEditors do
  use Ecto.Migration

  def change do
    rename(table("communities_editors"), to: table("communities_moderators"))

    rename(table(:communities), :editors_count, to: :moderators_count)
  end
end
