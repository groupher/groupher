defmodule GroupherServer.Repo.Migrations.CreateMentionSyncStates do
  @moduledoc "Creates the desired and synced set watermark for each Mention source."

  use Ecto.Migration

  @prefix "cms"

  def up do
    create table(:mention_sync_states, primary_key: false, prefix: @prefix) do
      add(:source_endpoint_id, references(:mention_endpoints, type: :uuid, on_delete: :restrict),
        primary_key: true
      )

      add(:desired_content_token, :text, null: false)
      add(:desired_set_id, :uuid, null: false)
      add(:synced_content_token, :text)
      add(:synced_set_id, :uuid)
      add(:synced_at, :timestamptz)
      timestamps()
    end

    execute("""
    ALTER TABLE cms.mention_sync_states
    ADD CONSTRAINT mention_sync_desired_set_fk
    FOREIGN KEY (desired_set_id, source_endpoint_id)
    REFERENCES cms.mention_sets (id, source_endpoint_id) ON DELETE RESTRICT
    """)

    execute("""
    ALTER TABLE cms.mention_sync_states
    ADD CONSTRAINT mention_sync_synced_set_fk
    FOREIGN KEY (synced_set_id, source_endpoint_id)
    REFERENCES cms.mention_sets (id, source_endpoint_id) ON DELETE RESTRICT
    """)

    create(
      index(:mention_sync_states, [:source_endpoint_id],
        prefix: @prefix,
        where:
          "desired_set_id IS DISTINCT FROM synced_set_id OR " <>
            "desired_content_token IS DISTINCT FROM synced_content_token",
        name: :mention_sync_pending_index
      )
    )
  end

  def down do
    drop(table(:mention_sync_states, prefix: @prefix))
  end
end
