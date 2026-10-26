defmodule GroupherServer.Repo.Migrations.RemoveArticleVisibilityProjectionFlags do
  use Ecto.Migration

  def up do
    assert_cutover_safe!()

    execute("DROP INDEX IF EXISTS cms.article_publics_visible_active_at_index")

    execute("ALTER TABLE cms.article_bindings DROP COLUMN visible")
    execute("ALTER TABLE cms.article_publics DROP COLUMN visible")

    create(index(:article_publics, [:active_at], prefix: "cms"))
  end

  def down do
    raise "Article visibility flags were derived from Lifecycle and ReviewRestrictions and are intentionally not restored"
  end

  defp assert_cutover_safe! do
    restriction_count =
      scalar!("""
      SELECT
        (SELECT count(*) FROM cms.article_review_restrictions WHERE ended_at IS NULL) +
        (SELECT count(*) FROM cms.comment_review_restrictions WHERE ended_at IS NULL) +
        (SELECT count(*) FROM cms.doc_review_restrictions WHERE ended_at IS NULL)
      """)

    pending_count =
      scalar!("""
      SELECT count(*) FROM alert_board.cases AS review_case
      WHERE review_case.status = 'open'
        AND (review_case.target_key LIKE 'article:%' OR review_case.target_key LIKE 'comment:%' OR review_case.target_key LIKE 'doc:%')
        AND NOT EXISTS (
          SELECT 1 FROM alert_board.reports AS report
          WHERE report.case_id = review_case.id AND report.withdrawn_at IS NULL
        )
        AND NOT EXISTS (
          SELECT 1 FROM alert_board.decisions AS decision
          WHERE decision.case_id = review_case.id
        )
      """)

    hidden_inconsistency = unexplained_hidden_count()

    if restriction_count != 0 or pending_count != 0 or hidden_inconsistency != 0 do
      raise "ReviewBot V2 projection cutover requires a clean preflight (active=#{restriction_count}, pending=#{pending_count}, unexplained_hidden=#{hidden_inconsistency})"
    end
  end

  defp unexplained_hidden_count do
    scalar!("""
    SELECT
      (SELECT COALESCE(count(*) FILTER (WHERE lifecycle.id IS NULL OR
         (lifecycle.state IN ('published', 'archived') AND NOT EXISTS (
           SELECT 1 FROM cms.article_review_restrictions restriction
           WHERE restriction.lifecycle_id = lifecycle.id AND restriction.scope_key = 'platform'
             AND restriction.ended_at IS NULL))), 0)
       FROM cms.article_publics AS public
       LEFT JOIN cms.article_lifecycles AS lifecycle ON lifecycle.article_id = public.article_id
       WHERE public.visible = false) +
      (SELECT COALESCE(count(*) FILTER (WHERE lifecycle.id IS NULL OR community.id IS NULL OR
         (lifecycle.state IN ('published', 'archived') AND
           ((community_lifecycle.id IS NOT NULL AND community_lifecycle.state IN ('active', 'read_only')) OR
            (community_lifecycle.id IS NULL AND community.pending = 0)) AND
           NOT EXISTS (SELECT 1 FROM cms.article_review_restrictions restriction
                       WHERE restriction.lifecycle_id = lifecycle.id AND restriction.ended_at IS NULL
                         AND restriction.scope_key IN ('platform', 'community:' || binding.community_id::text)))), 0)
       FROM cms.article_bindings AS binding
       LEFT JOIN cms.article_lifecycles AS lifecycle ON lifecycle.article_id = binding.article_id
       LEFT JOIN cms.communities AS community ON community.id = binding.community_id
       LEFT JOIN cms.community_lifecycles AS community_lifecycle
         ON community_lifecycle.community_id = binding.community_id
       WHERE binding.visible = false) +
      (SELECT COALESCE(count(*) FILTER (WHERE lifecycle.id IS NULL OR
         (lifecycle.state IN ('published', 'archived') AND NOT EXISTS (
           SELECT 1 FROM cms.doc_review_restrictions restriction
           WHERE restriction.lifecycle_id = lifecycle.id AND restriction.ended_at IS NULL))), 0)
       FROM cms.doc_publics AS public
       LEFT JOIN cms.doc_lifecycles AS lifecycle
         ON lifecycle.article_id = public.article_id AND lifecycle.branch_id = public.branch_id
       WHERE public.visible = false)
    """)
  end

  defp scalar!(sql) do
    %{rows: [[value]]} = repo().query!(sql)
    value
  end
end
