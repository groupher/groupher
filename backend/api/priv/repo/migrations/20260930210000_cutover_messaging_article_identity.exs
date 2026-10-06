defmodule GroupherServer.Repo.Migrations.CutoverMessagingArticleIdentity do
  use Ecto.Migration

  @moduledoc """
  Rebuilds ephemeral messaging delivery rows on stable Article UUID identity.

  The cutover runbook drains mention/notification jobs before this migration;
  existing grouped delivery rows cannot be mapped safely from a bare physical
  integer without their source table, so they are discarded at the declared
  no-compatibility boundary.
  """

  def up do
    execute("TRUNCATE TABLE messaging.notifications, messaging.mentions RESTART IDENTITY")

    alter table(:notifications, prefix: "messaging") do
      remove(:article_id)

      add(
        :article_id,
        references(:articles, prefix: "cms", type: :uuid, on_delete: :delete_all)
      )

      add(
        :branch_id,
        references(:doc_branches, prefix: "cms", on_delete: :delete_all)
      )
    end

    alter table(:mentions, prefix: "messaging") do
      remove(:article_id)

      add(
        :article_id,
        references(:articles, prefix: "cms", type: :uuid, on_delete: :delete_all),
        null: false
      )

      add(
        :branch_id,
        references(:doc_branches, prefix: "cms", on_delete: :delete_all)
      )
    end

    create(index(:notifications, [:article_id], prefix: "messaging"))
    create(index(:mentions, [:article_id], prefix: "messaging"))
  end

  def down do
    drop(index(:mentions, [:article_id], prefix: "messaging"))
    drop(index(:notifications, [:article_id], prefix: "messaging"))

    alter table(:mentions, prefix: "messaging") do
      remove(:branch_id)
      remove(:article_id)
      add(:article_id, :bigint, null: false)
    end

    alter table(:notifications, prefix: "messaging") do
      remove(:branch_id)
      remove(:article_id)
      add(:article_id, :bigint)
    end
  end
end
