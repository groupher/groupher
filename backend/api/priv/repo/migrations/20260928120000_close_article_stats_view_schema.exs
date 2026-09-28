defmodule GroupherServer.Repo.Migrations.CloseArticleStatsViewSchema do
  use Ecto.Migration

  @article_threads "'post', 'blog', 'changelog', 'doc'"

  def up do
    drop(table(:view_counting_rule_changes, prefix: "cms"))

    execute("""
    ALTER TABLE cms.article_emotion_counts
      DROP CONSTRAINT article_emotion_counts_non_negative_check,
      DROP COLUMN interaction_revision,
      ADD CONSTRAINT article_emotion_counts_non_negative_check CHECK (count >= 0)
    """)

    create(
      constraint(:article_stats, :article_stats_thread_check,
        prefix: "cms",
        check: "thread IN (#{@article_threads})"
      )
    )

    create(
      constraint(:article_stats, :article_stats_article_id_check,
        prefix: "cms",
        check: "article_id > 0"
      )
    )

    create(
      constraint(:article_viewer_states, :article_viewer_states_thread_check,
        prefix: "cms",
        check: "thread IN (#{@article_threads})"
      )
    )

    create(
      constraint(:article_viewer_states, :article_viewer_states_article_id_check,
        prefix: "cms",
        check: "article_id > 0"
      )
    )

    create(
      constraint(:article_view_dedupe_states, :article_view_dedupe_states_thread_check,
        prefix: "cms",
        check: "thread IN (#{@article_threads})"
      )
    )

    create(
      constraint(:article_view_dedupe_states, :article_view_dedupe_states_article_id_check,
        prefix: "cms",
        check: "article_id > 0"
      )
    )

    create(
      constraint(:article_view_dedupe_states, :article_view_dedupe_states_tracking_key_check,
        prefix: "cms",
        check: "octet_length(viewer_tracking_key) = 32"
      )
    )

    create(
      constraint(:article_view_dedupe_states, :article_view_dedupe_states_expiry_check,
        prefix: "cms",
        check: "expires_at >= last_counted_at"
      )
    )

    execute(
      "ALTER INDEX cms.article_viewer_states_target_user_index " <>
        "RENAME TO article_viewer_states_article_user_index"
    )

    execute(
      "ALTER INDEX cms.article_viewer_states_user_target_index " <>
        "RENAME TO article_viewer_states_user_article_index"
    )
  end

  def down do
    raise "CloseArticleStatsViewSchema is an irreversible direct cutover"
  end
end
