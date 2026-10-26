defmodule GroupherServer.Repo.Migrations.CreateCmsReviewRequests do
  use Ecto.Migration

  @cms "cms"
  @account "account"

  def up do
    create table(:review_requests, prefix: @cms, primary_key: false) do
      add(:id, :uuid, primary_key: true)
      add(:target_type, :text, null: false)
      add(:article_id, references(:articles, prefix: @cms, type: :uuid, on_delete: :restrict))
      add(:comment_id, references(:comments, prefix: @cms, on_delete: :restrict))
      add(:branch_id, references(:doc_branches, prefix: @cms, on_delete: :restrict))
      add(:community_id, references(:communities, prefix: @cms, on_delete: :restrict))
      add(:review_ref, :uuid, null: false)

      add(
        :article_revision_id,
        references(:article_revisions, prefix: @cms, type: :uuid, on_delete: :restrict)
      )

      add(:comment_body_version, :integer)
      add(:policy_snapshot, :map, null: false)
      add(:payload, :map, null: false)
      add(:state, :text, null: false, default: "queued")
      add(:result, :map)
      add(:updated_by_id, references(:users, prefix: @account, on_delete: :nilify_all))
      add(:applied_at, :timestamptz)
      add(:superseded_at, :timestamptz)
      add(:payload_expires_at, :timestamptz, null: false)
      timestamps()
    end

    create(
      constraint(:review_requests, :review_requests_target_type_check,
        check: "target_type IN ('article', 'comment', 'doc')",
        prefix: @cms
      )
    )

    create(
      constraint(:review_requests, :review_requests_state_check,
        check: "state IN ('queued', 'running', 'completed', 'failed')",
        prefix: @cms
      )
    )

    create(
      constraint(:review_requests, :review_requests_target_refs_check,
        check:
          "(target_type = 'article' AND article_id IS NOT NULL AND comment_id IS NULL AND branch_id IS NULL) OR " <>
            "(target_type = 'comment' AND article_id IS NULL AND comment_id IS NOT NULL AND branch_id IS NULL) OR " <>
            "(target_type = 'doc' AND article_id IS NOT NULL AND comment_id IS NULL AND branch_id IS NOT NULL)",
        prefix: @cms
      )
    )

    create(
      unique_index(:review_requests, [:article_id, :community_id],
        prefix: @cms,
        where: "target_type = 'article' AND superseded_at IS NULL AND community_id IS NOT NULL",
        name: :review_requests_current_article_community_index
      )
    )

    create(
      unique_index(:review_requests, [:article_id],
        prefix: @cms,
        where: "target_type = 'article' AND superseded_at IS NULL AND community_id IS NULL",
        name: :review_requests_current_article_system_index
      )
    )

    create(
      unique_index(:review_requests, [:comment_id, :community_id],
        prefix: @cms,
        where: "target_type = 'comment' AND superseded_at IS NULL AND community_id IS NOT NULL",
        name: :review_requests_current_comment_community_index
      )
    )

    create(
      unique_index(:review_requests, [:comment_id],
        prefix: @cms,
        where: "target_type = 'comment' AND superseded_at IS NULL AND community_id IS NULL",
        name: :review_requests_current_comment_system_index
      )
    )

    create(
      unique_index(:review_requests, [:article_id, :branch_id],
        prefix: @cms,
        where: "target_type = 'doc' AND superseded_at IS NULL",
        name: :review_requests_current_doc_branch_index
      )
    )

    create(index(:review_requests, [:state, :inserted_at, :id], prefix: @cms))
    create(index(:review_requests, [:payload_expires_at, :state], prefix: @cms))
    create(index(:review_requests, [:review_ref], prefix: @cms))
  end

  def down do
    drop(table(:review_requests, prefix: @cms))
  end
end
