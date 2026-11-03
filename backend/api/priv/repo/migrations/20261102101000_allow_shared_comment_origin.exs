defmodule GroupherServer.Repo.Migrations.AllowSharedCommentOrigin do
  @moduledoc "Preserves ordinary Comments when their creation Community is removed."

  use Ecto.Migration

  def up do
    execute("ALTER TABLE cms.comments DROP CONSTRAINT comments_community_id_fkey")
    execute("ALTER TABLE cms.comments ALTER COLUMN community_id DROP NOT NULL")

    execute("""
    ALTER TABLE cms.comments
      ADD CONSTRAINT comments_community_id_fkey
      FOREIGN KEY (community_id) REFERENCES cms.communities(id) ON DELETE SET NULL
    """)

    execute("ALTER TABLE cms.comments ALTER COLUMN thread SET NOT NULL")

    execute("""
    ALTER TABLE cms.comments
      ADD CONSTRAINT comments_thread_allowed_check
      CHECK (thread IN ('post', 'blog', 'changelog', 'doc'))
    """)

    execute("""
    ALTER TABLE cms.comments
      ADD CONSTRAINT comments_doc_origin_required_check
      CHECK (thread <> 'doc' OR community_id IS NOT NULL)
    """)
  end

  def down do
    execute("ALTER TABLE cms.comments DROP CONSTRAINT comments_doc_origin_required_check")
    execute("ALTER TABLE cms.comments DROP CONSTRAINT comments_thread_allowed_check")
    execute("ALTER TABLE cms.comments ALTER COLUMN thread DROP NOT NULL")
    execute("ALTER TABLE cms.comments DROP CONSTRAINT comments_community_id_fkey")
    execute("ALTER TABLE cms.comments ALTER COLUMN community_id SET NOT NULL")

    execute("""
    ALTER TABLE cms.comments
      ADD CONSTRAINT comments_community_id_fkey
      FOREIGN KEY (community_id) REFERENCES cms.communities(id) ON DELETE CASCADE
    """)
  end
end
