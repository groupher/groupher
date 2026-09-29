defmodule GroupherServer.Repo.Migrations.FinalizeDirectArticleViewCounting do
  use Ecto.Migration

  def up do
    create(
      constraint(:article_stats, :article_stats_non_negative_counts,
        prefix: "cms",
        check: """
        views >= 0 AND views_revision >= 0 AND
        upvotes_count >= 0 AND comments_count >= 0 AND collects_count >= 0 AND
        comments_participants_count >= 0 AND interaction_revision >= 0 AND
        comments_revision >= 0
        """
      )
    )

    execute("""
    INSERT INTO cms.view_counting_rule_changes (
      effective_at,
      changed_values,
      reason,
      deploy_revision,
      inserted_at
    ) VALUES (
      clock_timestamp(),
      '{"protocol":"synchronous","policyVersion":1,"humanMinVisibleMs":1000,"humanDedupeWindowSeconds":600,"agentDedupeWindowSeconds":600}'::jsonb,
      'Direct cutover from asynchronous ViewEvent projection to synchronous ArticleStats counting',
      '20260925101000-direct-article-view-counting-v1',
      clock_timestamp()
    )
    ON CONFLICT (deploy_revision) DO NOTHING
    """)
  end

  def down do
    raise "FinalizeDirectArticleViewCounting is an irreversible protocol record"
  end
end
