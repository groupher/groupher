defmodule GroupherServer.Repo.Migrations.CascadeDeletedReviewTargets do
  use Ecto.Migration

  @cms "cms"

  def up do
    execute("ALTER TABLE #{@cms}.review_requests DROP CONSTRAINT review_requests_article_id_fkey")
    execute("ALTER TABLE #{@cms}.review_requests DROP CONSTRAINT review_requests_comment_id_fkey")
    execute("ALTER TABLE #{@cms}.review_requests DROP CONSTRAINT review_requests_branch_id_fkey")

    execute(
      "ALTER TABLE #{@cms}.review_requests DROP CONSTRAINT review_requests_article_revision_id_fkey"
    )

    execute(
      "ALTER TABLE #{@cms}.review_requests DROP CONSTRAINT review_requests_branch_version_id_fkey"
    )

    execute("""
    ALTER TABLE #{@cms}.review_requests
      ADD CONSTRAINT review_requests_article_id_fkey
        FOREIGN KEY (article_id) REFERENCES #{@cms}.articles(id) ON DELETE CASCADE,
      ADD CONSTRAINT review_requests_comment_id_fkey
        FOREIGN KEY (comment_id) REFERENCES #{@cms}.comments(id) ON DELETE CASCADE,
      ADD CONSTRAINT review_requests_branch_id_fkey
        FOREIGN KEY (branch_id) REFERENCES #{@cms}.doc_branches(id) ON DELETE CASCADE,
      ADD CONSTRAINT review_requests_article_revision_id_fkey
        FOREIGN KEY (article_revision_id) REFERENCES #{@cms}.article_revisions(id) ON DELETE CASCADE,
      ADD CONSTRAINT review_requests_branch_version_id_fkey
        FOREIGN KEY (branch_version_id) REFERENCES #{@cms}.doc_branch_versions(id) ON DELETE CASCADE
    """)
  end

  def down do
    raise "deleted CMS review targets cannot restore their review requests"
  end
end
