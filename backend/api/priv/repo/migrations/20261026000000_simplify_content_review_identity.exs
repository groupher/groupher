defmodule GroupherServer.Repo.Migrations.SimplifyContentReviewIdentity do
  use Ecto.Migration

  def up do
    execute("ALTER TABLE cms.artiment_reviews ADD COLUMN replaced_at timestamptz")

    for name <- ~w(
      artiment_reviews_current_article_community_index
      artiment_reviews_current_article_system_index
      artiment_reviews_current_comment_community_index
      artiment_reviews_current_comment_system_index
      artiment_reviews_current_doc_branch_index
    ) do
      execute("DROP INDEX cms.#{name}")
    end

    execute("""
    CREATE UNIQUE INDEX artiment_reviews_current_article_community_index
      ON cms.artiment_reviews (article_id, community_id)
      WHERE target_type = 'article' AND replaced_at IS NULL AND community_id IS NOT NULL
    """)

    execute("""
    CREATE UNIQUE INDEX artiment_reviews_current_article_system_index
      ON cms.artiment_reviews (article_id)
      WHERE target_type = 'article' AND replaced_at IS NULL AND community_id IS NULL
    """)

    execute("""
    CREATE UNIQUE INDEX artiment_reviews_current_comment_community_index
      ON cms.artiment_reviews (comment_id, community_id)
      WHERE target_type = 'comment' AND replaced_at IS NULL AND community_id IS NOT NULL
    """)

    execute("""
    CREATE UNIQUE INDEX artiment_reviews_current_comment_system_index
      ON cms.artiment_reviews (comment_id)
      WHERE target_type = 'comment' AND replaced_at IS NULL AND community_id IS NULL
    """)

    execute("""
    CREATE UNIQUE INDEX artiment_reviews_current_doc_branch_index
      ON cms.artiment_reviews (article_id, branch_id)
      WHERE target_type = 'doc' AND replaced_at IS NULL
    """)

    execute("DROP INDEX cms.artiment_reviews_subject_ref_index")
    execute("ALTER TABLE cms.artiment_reviews DROP COLUMN subject_ref")

    for table <- ~w(article_review_blocks comment_review_blocks doc_review_blocks) do
      execute("ALTER TABLE cms.#{table} DROP COLUMN subject_ref")
    end

    execute("DROP INDEX alert_wall.alert_wall_items_one_open_community_index")
    execute("DROP INDEX alert_wall.alert_wall_items_one_open_system_index")

    execute("""
    CREATE UNIQUE INDEX alert_wall_items_one_open_community_index
      ON alert_wall.items (owner, target_type, target_id, community_id)
      WHERE status = 'open' AND community_id IS NOT NULL
    """)

    execute("""
    CREATE UNIQUE INDEX alert_wall_items_one_open_system_index
      ON alert_wall.items (owner, target_type, target_id)
      WHERE status = 'open' AND community_id IS NULL
    """)

    execute("ALTER TABLE alert_wall.items DROP COLUMN subject_ref")
    execute("DROP INDEX alert_wall.alert_wall_user_reports_active_community_unique")
    execute("DROP INDEX alert_wall.alert_wall_user_reports_active_system_unique")

    execute("""
    CREATE UNIQUE INDEX alert_wall_user_reports_active_item_unique
      ON alert_wall.user_reports (reporter_id, item_id)
      WHERE withdrawn_at IS NULL AND outdated_at IS NULL AND resolved_at IS NULL
    """)

    execute("ALTER TABLE alert_wall.user_reports DROP COLUMN subject_ref")
  end

  def down do
    raise "Review identity simplification is not reverted"
  end
end
