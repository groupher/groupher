defmodule GroupherServer.Repo.Migrations.AddReviewRequestBranchVersion do
  use Ecto.Migration

  @cms "cms"

  def up do
    alter table(:review_requests, prefix: @cms) do
      add(
        :branch_version_id,
        references(:doc_branch_versions, prefix: @cms, on_delete: :restrict)
      )
    end

    create(
      constraint(:review_requests, :review_requests_version_ref_check,
        check:
          "(target_type = 'article' AND article_revision_id IS NOT NULL AND comment_body_version IS NULL AND branch_version_id IS NULL) OR " <>
            "(target_type = 'comment' AND article_revision_id IS NULL AND comment_body_version IS NOT NULL AND branch_version_id IS NULL) OR " <>
            "(target_type = 'doc' AND article_revision_id IS NULL AND comment_body_version IS NULL AND branch_version_id IS NOT NULL)",
        prefix: @cms
      )
    )
  end

  def down do
    drop(constraint(:review_requests, :review_requests_version_ref_check, prefix: @cms))

    alter table(:review_requests, prefix: @cms) do
      remove(:branch_version_id)
    end
  end
end
