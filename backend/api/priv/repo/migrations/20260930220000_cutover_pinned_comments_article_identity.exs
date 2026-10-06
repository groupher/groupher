defmodule GroupherServer.Repo.Migrations.CutoverPinnedCommentsArticleIdentity do
  use Ecto.Migration

  @moduledoc """
  Moves the pinned-comment presentation relation to stable Article identity.

  Existing rows are ephemeral projections and are rebuilt after the direct
  cutover; no physical thread-table foreign key remains authoritative.
  """

  def up do
    execute("TRUNCATE TABLE cms.pinned_comments RESTART IDENTITY")

    alter table(:pinned_comments, prefix: "cms") do
      add(:article_id, references(:articles, type: :uuid, on_delete: :delete_all))
      add(:branch_id, references(:doc_branches, on_delete: :delete_all))
    end

    create(index(:pinned_comments, [:article_id], prefix: "cms"))

    create(
      unique_index(:pinned_comments, [:article_id, :comment_id],
        prefix: "cms",
        name: :pinned_comments_stable_article_target_index,
        where: "branch_id IS NULL"
      )
    )

    create(
      unique_index(:pinned_comments, [:article_id, :branch_id, :comment_id],
        prefix: "cms",
        name: :pinned_comments_stable_doc_target_index,
        where: "branch_id IS NOT NULL"
      )
    )
  end

  def down do
    drop(
      index(:pinned_comments, [:article_id, :branch_id, :comment_id],
        prefix: "cms",
        name: :pinned_comments_stable_doc_target_index
      )
    )

    drop(
      index(:pinned_comments, [:article_id, :comment_id],
        prefix: "cms",
        name: :pinned_comments_stable_article_target_index
      )
    )

    drop(index(:pinned_comments, [:article_id], prefix: "cms"))

    alter table(:pinned_comments, prefix: "cms") do
      remove(:branch_id)
      remove(:article_id)
    end
  end
end
