defmodule GroupherServer.Repo.Migrations.RenamePostCatStateToStatus do
  use Ecto.Migration

  def up do
    rename(table(:posts, prefix: "cms"), :state, to: :status)

    execute("""
    ALTER INDEX IF EXISTS cms.cms_posts_cat_state_index
    RENAME TO cms_posts_cat_status_index
    """)

    execute("""
    ALTER INDEX IF EXISTS cms.cms_posts_state_index
    RENAME TO cms_posts_status_index
    """)

    execute("""
    UPDATE cms.posts
    SET cat = CASE cat
      WHEN 'feature' THEN 'idea'
      WHEN 'question' THEN 'qa'
      WHEN 'other' THEN 'discussion'
      ELSE cat
    END
    """)
  end

  def down do
    execute("""
    UPDATE cms.posts
    SET cat = CASE cat
      WHEN 'idea' THEN 'feature'
      WHEN 'qa' THEN 'question'
      WHEN 'discussion' THEN 'other'
      ELSE cat
    END
    """)

    rename(table(:posts, prefix: "cms"), :status, to: :state)

    execute("""
    ALTER INDEX IF EXISTS cms.cms_posts_cat_status_index
    RENAME TO cms_posts_cat_state_index
    """)

    execute("""
    ALTER INDEX IF EXISTS cms.cms_posts_status_index
    RENAME TO cms_posts_state_index
    """)
  end
end
