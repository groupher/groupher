defmodule GroupherServer.Repo.Migrations.RemoveLegacyArticleAndCommentStates do
  use Ecto.Migration

  @cms_prefix "cms"

  def up do
    for table <- [:posts, :blogs, :changelogs, :docs] do
      alter table(table, prefix: @cms_prefix) do
        remove(:is_archived)
        remove(:archived_at)
      end
    end

    alter table(:comments, prefix: @cms_prefix) do
      remove(:is_deleted)
      remove(:is_archived)
      remove(:archived_at)
    end
  end

  def down do
    for table <- [:posts, :blogs, :changelogs, :docs] do
      alter table(table, prefix: @cms_prefix) do
        add(:is_archived, :boolean, default: false, null: false)
        add(:archived_at, :timestamptz)
      end
    end

    alter table(:comments, prefix: @cms_prefix) do
      add(:is_deleted, :boolean, default: false, null: false)
      add(:is_archived, :boolean, default: false, null: false)
      add(:archived_at, :timestamptz)
    end
  end
end
