defmodule GroupherServer.Repo.Migrations.DirectArticleViewCounting do
  use Ecto.Migration

  def up do
    execute("""
    DELETE FROM oban_jobs
    WHERE worker IN (
      'GroupherServer.Jobs.ViewProjection',
      'GroupherServer.Jobs.ViewEventRetention'
    )
    """)

    drop(table(:view_events, prefix: "cms"))
    drop(table(:article_view_summaries, prefix: "cms"))

    rename(
      table(:article_view_dedupe_states, prefix: "cms"),
      to: table(:article_view_watermarks, prefix: "cms")
    )

    execute(
      "ALTER INDEX cms.article_view_dedupe_states_target_viewer_index " <>
        "RENAME TO article_view_watermarks_article_viewer_index"
    )

    execute(
      "ALTER INDEX cms.article_view_dedupe_states_last_counted_at_index " <>
        "RENAME TO article_view_watermarks_last_counted_at_index"
    )

    alter table(:article_view_watermarks, prefix: "cms") do
      add(:updated_at, :timestamptz)
    end

    execute("""
    UPDATE cms.article_view_watermarks
    SET updated_at = inserted_at
    WHERE updated_at IS NULL
    """)

    alter table(:article_view_watermarks, prefix: "cms") do
      modify(:updated_at, :timestamptz, null: false)
    end

    create table(:article_view_count_receipts, primary_key: false, prefix: "cms") do
      add(:event_id, :uuid, primary_key: true)
      add(:thread, :string, null: false)
      add(:article_id, :bigint, null: false)
      add(:viewer_tracking_key, :binary, null: false)
      add(:state, :string, null: false)
      add(:counted, :boolean)
      add(:decision_reason, :string)
      add(:expires_at, :timestamptz, null: false)

      timestamps(updated_at: false)
    end

    create(
      constraint(:article_view_count_receipts, :article_view_count_receipts_state_check,
        prefix: "cms",
        check:
          "(state = 'pending' AND counted IS NULL AND decision_reason IS NULL) OR " <>
            "(state = 'finalized' AND counted IS NOT NULL AND decision_reason IN ('counted', 'duplicate_in_window'))"
      )
    )

    create(
      index(:article_view_count_receipts, [:expires_at, :event_id],
        prefix: "cms",
        name: :article_view_count_receipts_expiry_index
      )
    )

    create(
      index(:article_view_count_receipts, [:thread, :article_id],
        prefix: "cms",
        name: :article_view_count_receipts_article_index
      )
    )

    create table(:view_counting_rule_changes, prefix: "cms") do
      add(:effective_at, :timestamptz, null: false)
      add(:changed_values, :map, null: false, default: %{})
      add(:reason, :string, null: false)
      add(:deploy_revision, :string, null: false)

      timestamps(updated_at: false)
    end

    create(
      unique_index(:view_counting_rule_changes, [:deploy_revision],
        prefix: "cms",
        name: :view_counting_rule_changes_deploy_revision_index
      )
    )

    execute("""
    ALTER TABLE cms.article_stats
    ALTER COLUMN snapshot_at
    SET DEFAULT date_trunc('second', clock_timestamp())
    """)

    execute("""
    ALTER TABLE cms.article_stats
    ALTER COLUMN inserted_at
    SET DEFAULT date_trunc('second', clock_timestamp()),
    ALTER COLUMN updated_at
    SET DEFAULT date_trunc('second', clock_timestamp())
    """)
  end

  def down do
    raise "DirectArticleViewCounting is an irreversible protocol cutover"
  end
end
