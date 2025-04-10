defmodule GroupherServer.Repo.Migrations.RenameOriginalField do
  use Ecto.Migration

  @prefix "cms"

  def change do
    rename(table(:posts, prefix: @prefix), :original_community_slug, to: :community_slug)
    rename(table(:blogs, prefix: @prefix), :original_community_slug, to: :community_slug)
    rename(table(:changelogs, prefix: @prefix), :original_community_slug, to: :community_slug)
    rename(table(:docs, prefix: @prefix), :original_community_slug, to: :community_slug)

    alter table(:posts, prefix: @prefix) do
      remove(:original_community_id)
      add(:community_id, references(:communities, prefix: @prefix, on_delete: :delete_all))
    end

    alter table(:blogs, prefix: @prefix) do
      remove(:original_community_id)
      add(:community_id, references(:communities, prefix: @prefix, on_delete: :delete_all))
    end

    alter table(:changelogs, prefix: @prefix) do
      remove(:original_community_id)
      add(:community_id, references(:communities, prefix: @prefix, on_delete: :delete_all))
    end

    alter table(:docs, prefix: @prefix) do
      remove(:original_community_id)
      add(:community_id, references(:communities, prefix: @prefix, on_delete: :delete_all))
    end
  end
end
