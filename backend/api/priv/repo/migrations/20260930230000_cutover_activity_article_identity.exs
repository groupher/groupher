defmodule GroupherServer.Repo.Migrations.CutoverActivityArticleIdentity do
  use Ecto.Migration

  @moduledoc """
  Rebuilds Article Activity streams on stable Article UUID identity.

  The deployment runbook freezes writes and drains Activity producers before
  this no-compatibility cutover. Existing rows refer to the retired physical
  Article hash namespace, so they cannot remain a second aggregate authority.
  """

  @streams [
    {:post_logs, :post_ref},
    {:blog_logs, :blog_ref},
    {:changelog_logs, :changelog_ref},
    {:doc_logs, :doc_ref}
  ]

  def up do
    Enum.each(@streams, fn {table, old_column} ->
      execute("TRUNCATE TABLE activity.#{table}")

      alter table(table, prefix: "activity") do
        remove(old_column)

        # Activity is append-only. Keep the stable Article UUID as historical
        # stream identity without an FK that would erase audit on destruction.
        add(:article_id, :uuid, null: false)
      end

      create(index(table, [:article_id, :occurred_at], prefix: "activity"))
    end)

    alter table(:doc_logs, prefix: "activity") do
      remove(:branch_ref)
      add(:branch_id, references(:doc_branches, prefix: "cms", on_delete: :nilify_all))
    end

    create(index(:doc_logs, [:article_id, :branch_id, :occurred_at], prefix: "activity"))
  end

  def down do
    drop_if_exists(index(:doc_logs, [:article_id, :branch_id, :occurred_at], prefix: "activity"))

    alter table(:doc_logs, prefix: "activity") do
      remove(:branch_id)
      add(:branch_ref, :string)
    end

    Enum.each(Enum.reverse(@streams), fn {table, old_column} ->
      drop_if_exists(index(table, [:article_id, :occurred_at], prefix: "activity"))
      execute("TRUNCATE TABLE activity.#{table}")

      alter table(table, prefix: "activity") do
        remove(:article_id)
        add(old_column, :string, null: false)
      end
    end)
  end
end
