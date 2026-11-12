defmodule GroupherServer.Repo.Migrations.CreateDocsPublicationNotifications do
  use Ecto.Migration

  def change do
    create table(:docs_publication_notifications, prefix: "cms", primary_key: false) do
      add(:event_id, :uuid, primary_key: true)

      add(:user_id, references(:users, prefix: "account", on_delete: :delete_all),
        primary_key: true
      )

      add(:community_id, references(:communities, prefix: "cms", on_delete: :delete_all),
        null: false
      )

      add(:status, :text, null: false)
      add(:queue_revision, :bigint, null: false)
      add(:inserted_at, :timestamptz, null: false)
    end

    create(
      index(:docs_publication_notifications, [:community_id, :user_id, :inserted_at],
        prefix: "cms"
      )
    )
  end
end
