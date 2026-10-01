defmodule GroupherServer.Repo.Migrations.RestorePostSolutionArticleOwnership do
  @moduledoc """
  Restores the database invariant that an accepted solution Comment belongs to
  the stable Article named by the solution row.
  """

  use Ecto.Migration

  def up do
    execute("""
    CREATE UNIQUE INDEX IF NOT EXISTS comments_id_article_id_index
    ON cms.comments (id, article_id)
    """)

    execute("""
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'post_solutions_comment_belongs_to_article_fkey'
          AND conrelid = 'cms.post_solutions'::regclass
      ) THEN
        ALTER TABLE cms.post_solutions
        ADD CONSTRAINT post_solutions_comment_belongs_to_article_fkey
        FOREIGN KEY (comment_id, article_id)
        REFERENCES cms.comments(id, article_id)
        ON DELETE CASCADE;
      END IF;
    END
    $$
    """)
  end

  def down do
    execute("""
    ALTER TABLE cms.post_solutions
    DROP CONSTRAINT IF EXISTS post_solutions_comment_belongs_to_article_fkey
    """)

    execute("DROP INDEX IF EXISTS cms.comments_id_article_id_index")
  end
end
