defmodule GroupherServer.Repo.Migrations.CutoverArtimentMentionsArticleIdentity do
  @moduledoc "Adds stable Article and optional Doc branch identities to mention facts."

  use Ecto.Migration

  @prefix "cms"

  def change do
    alter table(:artiment_mentions, prefix: @prefix) do
      modify(:mentioner_id, :bigint, null: true)
      add(:mentioner_article_id, references(:articles, type: :uuid, on_delete: :delete_all))
      add(:mentioner_branch_id, references(:doc_branches, on_delete: :delete_all))
      add(:mentioned_article_id, references(:articles, type: :uuid, on_delete: :nilify_all))
      add(:mentioned_branch_id, references(:doc_branches, on_delete: :nilify_all))
    end

    create(
      index(:artiment_mentions, [:mentioner_article_id, :mentioner_branch_id],
        prefix: @prefix,
        name: :artiment_mentions_stable_mentioner_index
      )
    )

    create(
      index(:artiment_mentions, [:mentioned_article_id, :mentioned_branch_id],
        prefix: @prefix,
        name: :artiment_mentions_stable_mentioned_index
      )
    )

    create(
      constraint(:artiment_mentions, :artiment_mentions_mentioner_identity_check,
        prefix: @prefix,
        check:
          "(mentioner_id IS NOT NULL AND mentioner_article_id IS NULL) OR " <>
            "(mentioner_id IS NULL AND mentioner_article_id IS NOT NULL)"
      )
    )
  end
end
