defmodule GroupherServer.Repo.Migrations.SimplifyMentionCurrentEdges do
  @moduledoc "Replaces version facts with direct current Mention relationships on an empty target."

  use Ecto.Migration

  @prefix "cms"
  @internal_types "'post','blog','changelog','doc','ticket','comment'"

  def up do
    execute("""
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM cms.articles)
         OR EXISTS (SELECT 1 FROM cms.comments)
         OR EXISTS (SELECT 1 FROM cms.mention_endpoints)
         OR EXISTS (SELECT 1 FROM cms.mention_current_edges)
         OR EXISTS (SELECT 1 FROM cms.mention_sets)
         OR EXISTS (SELECT 1 FROM cms.mention_current_sets) THEN
        RAISE EXCEPTION 'MentionsGraph simplification requires an empty target database';
      END IF;
    END
    $$
    """)

    drop(table(:mention_current_edges, prefix: @prefix))
    drop(table(:mention_current_sets, prefix: @prefix))
    drop(table(:mention_occurrences, prefix: @prefix))
    drop(table(:mention_sets, prefix: @prefix))

    create table(:mention_current_edges, primary_key: false, prefix: @prefix) do
      add(:id, :uuid, primary_key: true)

      add(:source_endpoint_id, references(:mention_endpoints, type: :uuid, on_delete: :restrict),
        null: false
      )

      add(:target_type, :string, null: false)
      add(:target_endpoint_id, :uuid)
      add(:target_user_id, :bigint)
      add(:normalized_url, :text)
      add(:url_hash, :text)
      add(:mention_case, :string, null: false)
      add(:edge_key, :text, null: false)
      add(:mentioned_at, :timestamptz, null: false)
      add(:occurrences_count, :integer, null: false)
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

    create(
      constraint(:mention_current_edges, :mention_current_edge_count_check,
        prefix: @prefix,
        check: "occurrences_count > 0"
      )
    )

    create(
      constraint(:mention_current_edges, :mention_current_edge_url_size_check,
        prefix: @prefix,
        check: "target_type != 'url' OR octet_length(normalized_url) <= 1200"
      )
    )

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

    create(
      index(:mention_current_edges, [:source_endpoint_id, :edge_key],
        prefix: @prefix,
        name: :mention_current_edge_source_window_index
      )
    )

    create(
      index(:mention_current_edges, [:target_endpoint_id, :edge_key],
        prefix: @prefix,
        where: "target_endpoint_id IS NOT NULL",
        name: :mention_current_edge_target_window_index
      )
    )

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
      unique_index(:mention_current_edges, [:source_endpoint_id, :target_user_id, :mention_case],
        prefix: @prefix,
        where: "target_type = 'user'",
        name: :mention_current_edge_user_identity_index
      )
    )

    create(
      unique_index(:mention_current_edges, [:source_endpoint_id, :normalized_url, :mention_case],
        prefix: @prefix,
        where: "target_type = 'url'",
        name: :mention_current_edge_url_identity_index
      )
    )
  end

  def down do
    raise "MentionsGraph old version facts are intentionally not restored"
  end
end
