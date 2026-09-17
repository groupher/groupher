defmodule GroupherServer.Repo.Migrations.CreateArticleViewSummaries do
  use Ecto.Migration

  @article_tables ~w(posts blogs changelogs docs)a

  def up do
    Enum.each(@article_tables, fn table_name ->
      execute("ALTER TABLE cms.#{table_name} DROP COLUMN IF EXISTS views")
      execute("ALTER TABLE cms.#{table_name} DROP COLUMN IF EXISTS views_revision")
    end)

    drop(constraint(:view_events, :view_events_projection_state_check, prefix: "cms"))

    alter table(:view_events, prefix: "cms") do
      add(:projection_state, :string, null: false, default: "pending")
      add(:projection_generation, :integer, null: false, default: 1)
      add(:current_projection_job_id, :bigint)
      add(:projection_retry_deadline_at, :timestamptz)
    end

    # The previous protocol only had `projected_at`. Normalize existing rows
    # before installing the V2 state constraint; this does not rebuild Summary
    # or restore any historical Article view total.
    execute("""
    UPDATE cms.view_events
    SET projection_state = CASE
      WHEN projected_at IS NULL THEN 'pending'
      ELSE 'applied'
    END
    """)

    create(
      constraint(:view_events, :view_events_projection_state_check,
        check:
          "(counted = false AND projection_state = 'applied' AND projected_at IS NOT NULL) OR " <>
            "(counted = true AND projection_state IN ('pending', 'applied', 'article_deleted', 'dead_letter', 'dropped'))",
        prefix: "cms"
      )
    )

    create(index(:view_events, [:projection_state, :projection_retry_deadline_at], prefix: "cms"))
    create(index(:view_events, [:current_projection_job_id], prefix: "cms"))

    create table(:article_view_summaries, prefix: "cms") do
      add(:thread, :string, null: false)
      add(:article_id, :bigint, null: false)
      add(:views, :bigint, null: false, default: 0)
      add(:revision, :bigint, null: false, default: 0)

      timestamps()
    end

    create(
      unique_index(:article_view_summaries, [:thread, :article_id],
        prefix: "cms",
        name: :article_view_summaries_thread_article_index
      )
    )

    create(
      constraint(:article_view_summaries, :article_view_summaries_non_negative_check,
        check: "views >= 0 AND revision >= 0",
        prefix: "cms"
      )
    )

    Enum.each(@article_tables, fn table_name ->
      create(index(table_name, [:community_id, :inner_id], prefix: "cms"))
    end)
  end

  def down do
    Enum.each(@article_tables, fn table_name ->
      drop(index(table_name, [:community_id, :inner_id], prefix: "cms"))
    end)

    drop(
      constraint(:article_view_summaries, :article_view_summaries_non_negative_check,
        prefix: "cms"
      )
    )

    drop(
      index(:article_view_summaries, [:thread, :article_id],
        prefix: "cms",
        name: :article_view_summaries_thread_article_index
      )
    )

    drop(table(:article_view_summaries, prefix: "cms"))

    drop(index(:view_events, [:current_projection_job_id], prefix: "cms"))
    drop(index(:view_events, [:projection_state, :projection_retry_deadline_at], prefix: "cms"))
    drop(constraint(:view_events, :view_events_projection_state_check, prefix: "cms"))

    alter table(:view_events, prefix: "cms") do
      remove(:projection_retry_deadline_at)
      remove(:current_projection_job_id)
      remove(:projection_generation)
      remove(:projection_state)
    end

    create(
      constraint(:view_events, :view_events_projection_state_check,
        check: "counted = true OR projected_at IS NOT NULL",
        prefix: "cms"
      )
    )

    Enum.each(@article_tables, fn table_name ->
      execute("ALTER TABLE cms.#{table_name} ADD COLUMN views integer NOT NULL DEFAULT 0")
      execute("ALTER TABLE cms.#{table_name} ADD COLUMN views_revision bigint NOT NULL DEFAULT 0")
    end)
  end
end
