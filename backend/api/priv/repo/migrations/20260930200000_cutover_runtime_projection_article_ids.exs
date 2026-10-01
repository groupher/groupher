defmodule GroupherServer.Repo.Migrations.CutoverRuntimeProjectionArticleIds do
  use Ecto.Migration

  @moduledoc """
  Rebuilds disposable runtime projections on the stable Article UUID.

  These tables are projections or diagnostic event stores and are deliberately
  emptied during the no-compatibility cutover before their key type changes.
  """

  @tables [
    :article_stats,
    :article_emotion_counts,
    :analysis_metric_events,
    :article_hourly_metrics,
    :article_viewer_states,
    :article_view_dedupe_states
  ]

  def up do
    execute("DROP TRIGGER IF EXISTS comments_community_matches_article ON cms.comments")
    execute("DROP FUNCTION IF EXISTS cms.ensure_comment_community_matches_article()")

    execute(
      "ALTER TABLE cms.article_stats DROP CONSTRAINT IF EXISTS article_stats_article_id_check"
    )

    execute(
      "ALTER TABLE cms.article_viewer_states " <>
        "DROP CONSTRAINT IF EXISTS article_viewer_states_article_id_check"
    )

    execute(
      "ALTER TABLE cms.article_view_dedupe_states " <>
        "DROP CONSTRAINT IF EXISTS article_view_dedupe_states_article_id_check"
    )

    Enum.each(@tables, fn table ->
      execute("TRUNCATE TABLE cms.#{table}")
      execute("ALTER TABLE cms.#{table} ALTER COLUMN article_id TYPE uuid USING NULL::uuid")

      execute(
        "ALTER TABLE cms.#{table} ADD CONSTRAINT #{table}_stable_article_fkey " <>
          "FOREIGN KEY (article_id) REFERENCES cms.articles(id) ON DELETE CASCADE"
      )
    end)
  end

  def down do
    Enum.each(Enum.reverse(@tables), fn table ->
      execute("ALTER TABLE cms.#{table} DROP CONSTRAINT IF EXISTS #{table}_stable_article_fkey")
      execute("TRUNCATE TABLE cms.#{table}")
      execute("ALTER TABLE cms.#{table} ALTER COLUMN article_id TYPE bigint USING NULL::bigint")
    end)
  end
end
