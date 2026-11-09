defmodule GroupherServer.Repo.Migrations.CreateMentionCurrentEdges do
  @moduledoc "Creates the grouped current projection for immutable Mention sets."

  use Ecto.Migration

  @prefix "cms"
  @internal_types "'post','blog','changelog','doc','ticket','comment'"

  def up do
    create table(:mention_current_edges, primary_key: false, prefix: @prefix) do
      add(:id, :uuid, primary_key: true)
      add(:source_endpoint_id, :uuid, null: false)
      add(:source_set_id, :uuid, null: false)
      add(:target_type, :string, null: false)
      add(:target_endpoint_id, :uuid)
      add(:target_user_id, :bigint)
      add(:normalized_url, :text)
      add(:url_hash, :text)
      add(:mention_case, :string, null: false)
      add(:edge_key, :text, null: false)
      add(:mentioned_at, :timestamptz, null: false)
      add(:occurrences, :map, null: false)
      timestamps()
    end

    create(
      constraint(:mention_current_edges, :mention_current_edge_target_check,
        prefix: @prefix,
        check:
          "(target_type IN (#{@internal_types}) AND target_endpoint_id IS NOT NULL " <>
            "AND target_user_id IS NULL AND normalized_url IS NULL AND url_hash IS NULL) OR " <>
            "(target_type = 'user' AND target_endpoint_id IS NULL " <>
            "AND target_user_id IS NOT NULL AND normalized_url IS NULL AND url_hash IS NULL) OR " <>
            "(target_type = 'url' AND target_endpoint_id IS NULL " <>
            "AND target_user_id IS NULL AND normalized_url IS NOT NULL AND url_hash IS NOT NULL)"
      )
    )

    create(
      constraint(:mention_current_edges, :mention_current_edge_case_check,
        prefix: @prefix,
        check: "mention_case IN ('inline_mention', 'link')"
      )
    )

    execute("""
    ALTER TABLE cms.mention_current_edges
    ADD CONSTRAINT mention_current_edge_source_set_fk
    FOREIGN KEY (source_set_id, source_endpoint_id)
    REFERENCES cms.mention_sets (id, source_endpoint_id) ON DELETE RESTRICT
    """)

    execute("""
    ALTER TABLE cms.mention_current_edges
    ADD CONSTRAINT mention_current_edge_target_identity_fk
    FOREIGN KEY (target_endpoint_id, target_type)
    REFERENCES cms.mention_endpoints (id, type) ON DELETE RESTRICT
    """)

    create(
      unique_index(:mention_current_edges, [:edge_key],
        prefix: @prefix,
        name: :mention_current_edge_key_index
      )
    )

    create(index(:mention_current_edges, [:source_endpoint_id], prefix: @prefix))
    create(index(:mention_current_edges, [:target_endpoint_id], prefix: @prefix))

    create(
      unique_index(
        :mention_current_edges,
        [:source_endpoint_id, :target_endpoint_id, :mention_case],
        prefix: @prefix,
        where: "target_endpoint_id IS NOT NULL",
        name: :mention_current_edge_endpoint_identity_index
      )
    )

    create(
      unique_index(
        :mention_current_edges,
        [:source_endpoint_id, :target_user_id, :mention_case],
        prefix: @prefix,
        where: "target_type = 'user'",
        name: :mention_current_edge_user_identity_index
      )
    )

    create(
      unique_index(
        :mention_current_edges,
        [:source_endpoint_id, :normalized_url, :mention_case],
        prefix: @prefix,
        where: "target_type = 'url'",
        name: :mention_current_edge_url_identity_index
      )
    )
  end

  def down do
    drop(table(:mention_current_edges, prefix: @prefix))
  end
end
