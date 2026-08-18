defmodule GroupherServer.Repo.Migrations.AddTrashRestoreState do
  use Ecto.Migration

  @prefix "cms"

  def change do
    alter table(:trashed_articles, prefix: @prefix) do
      add(:restore_state, :string, default: "draft_only", null: false)
    end

    create(
      constraint(:trashed_articles, :trashed_articles_restore_state_check,
        prefix: @prefix,
        check: "restore_state IN ('draft_only', 'published', 'archived')"
      )
    )
  end
end
