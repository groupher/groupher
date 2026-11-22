defmodule GroupherServer.Repo.Migrations.CreateDocsPublishQueue do
  use Ecto.Migration

  @prefix "cms"

  def change do
    create table(:docs_publish_queues, primary_key: false, prefix: @prefix) do
      add(:id, :uuid, primary_key: true)

      add(:community_id, references(:communities, prefix: @prefix, on_delete: :restrict),
        null: false
      )

      add(:tree_lock_version, :bigint, null: false, default: 0)
      add(:queue_revision, :bigint, null: false, default: 0)
      add(:public_presentation_revision, :bigint, null: false, default: 0)
      add(:approval_policy_revision, :bigint, null: false, default: 0)
      add(:approval_required, :boolean, null: false, default: false)
      add(:allow_self_approval, :boolean, null: false, default: false)
      add(:public_release_id, :bigint)
      add(:latest_approval_id, :uuid)
      timestamps()
    end

    create(unique_index(:docs_publish_queues, [:community_id], prefix: @prefix))
    create(unique_index(:docs_publish_queues, [:id, :community_id], prefix: @prefix))

    for column <- [
          :tree_lock_version,
          :queue_revision,
          :public_presentation_revision,
          :approval_policy_revision
        ] do
      create(
        constraint(:docs_publish_queues, "docs_publish_queues_#{column}_nonnegative",
          check: "#{column} >= 0",
          prefix: @prefix
        )
      )
    end

    # The branch-free Release and approval tables are created at cutover. Until
    # their same-site foreign keys exist, these pointers cannot be populated.
    create(
      constraint(:docs_publish_queues, :docs_publish_queues_unavailable_history_check,
        check: "public_release_id IS NULL AND latest_approval_id IS NULL",
        prefix: @prefix
      )
    )

    create table(:docs_queue_articles, primary_key: false, prefix: @prefix) do
      add(
        :queue_id,
        references(:docs_publish_queues, type: :uuid, prefix: @prefix, on_delete: :delete_all),
        primary_key: true
      )

      add(:article_id, references(:articles, type: :uuid, prefix: @prefix, on_delete: :restrict),
        primary_key: true
      )

      add(:working_copy_id, :uuid, null: false)
      add(:source_snapshot_id, :uuid, null: false)

      add(:enqueued_by_id, references(:users, prefix: "account", on_delete: :restrict),
        null: false
      )

      timestamps()
    end

    create(unique_index(:docs_queue_articles, [:working_copy_id], prefix: @prefix))
    create(index(:docs_queue_articles, [:source_snapshot_id], prefix: @prefix))

    execute(
      """
      ALTER TABLE cms.docs_queue_articles ADD CONSTRAINT docs_queue_articles_work_owner_fkey
      FOREIGN KEY (article_id, working_copy_id)
      REFERENCES cms.article_working_copies(article_id, id) ON DELETE RESTRICT
      """,
      "ALTER TABLE cms.docs_queue_articles DROP CONSTRAINT docs_queue_articles_work_owner_fkey"
    )

    execute(
      """
      ALTER TABLE cms.docs_queue_articles ADD CONSTRAINT docs_queue_articles_snapshot_owner_fkey
      FOREIGN KEY (article_id, source_snapshot_id)
      REFERENCES cms.article_snapshots(article_id, id) ON DELETE RESTRICT
      """,
      "ALTER TABLE cms.docs_queue_articles DROP CONSTRAINT docs_queue_articles_snapshot_owner_fkey"
    )

    create table(:docs_queue_article_contributors, primary_key: false, prefix: @prefix) do
      add(:queue_id, :uuid, primary_key: true)
      add(:article_id, :uuid, primary_key: true)

      add(:user_id, references(:users, prefix: "account", on_delete: :restrict),
        primary_key: true
      )
    end

    execute(
      """
      ALTER TABLE cms.docs_queue_article_contributors ADD CONSTRAINT docs_queue_article_contributors_member_fkey
      FOREIGN KEY (queue_id, article_id)
      REFERENCES cms.docs_queue_articles(queue_id, article_id) ON DELETE CASCADE
      """,
      "ALTER TABLE cms.docs_queue_article_contributors DROP CONSTRAINT docs_queue_article_contributors_member_fkey"
    )
  end
end
