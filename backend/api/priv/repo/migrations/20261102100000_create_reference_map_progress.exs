defmodule GroupherServer.Repo.Migrations.CreateReferenceMapProgress do
  @moduledoc "Stores stable Mention source progress and Community graph revisions."

  use Ecto.Migration

  @prefix "cms"

  def change do
    create table(:artiment_mention_sync_states, prefix: @prefix) do
      add(:source_type, :string, null: false)
      add(:source_article_id, references(:articles, type: :uuid, on_delete: :delete_all))
      add(:source_comment_id, references(:comments, on_delete: :delete_all))
      add(:source_branch_id, references(:doc_branches, on_delete: :delete_all))
      add(:desired_content_token, :text, null: false)
      add(:synced_content_token, :text)
      add(:synced_at, :timestamptz)

      timestamps()
    end

    create(
      constraint(:artiment_mention_sync_states, :mention_sync_source_identity_check,
        prefix: @prefix,
        check:
          "(source_article_id IS NOT NULL AND source_comment_id IS NULL) OR " <>
            "(source_article_id IS NULL AND source_comment_id IS NOT NULL)"
      )
    )

    create(
      constraint(:artiment_mention_sync_states, :mention_sync_source_branch_check,
        prefix: @prefix,
        check:
          "(source_type IN ('post', 'blog', 'changelog', 'ticket') AND " <>
            "source_article_id IS NOT NULL AND source_branch_id IS NULL) OR " <>
            "(source_type = 'doc' AND source_article_id IS NOT NULL AND " <>
            "source_branch_id IS NOT NULL) OR " <>
            "(source_type = 'comment' AND source_comment_id IS NOT NULL)"
      )
    )

    create(
      unique_index(:artiment_mention_sync_states, [:source_type, :source_article_id],
        prefix: @prefix,
        where: "source_article_id IS NOT NULL AND source_branch_id IS NULL",
        name: :mention_sync_article_source_unique
      )
    )

    create(
      unique_index(
        :artiment_mention_sync_states,
        [:source_type, :source_article_id, :source_branch_id],
        prefix: @prefix,
        where: "source_article_id IS NOT NULL AND source_branch_id IS NOT NULL",
        name: :mention_sync_doc_source_unique
      )
    )

    create(
      unique_index(:artiment_mention_sync_states, [:source_comment_id],
        prefix: @prefix,
        where: "source_comment_id IS NOT NULL",
        name: :mention_sync_comment_source_unique
      )
    )

    create(
      index(:artiment_mention_sync_states, [:source_type, :id],
        prefix: @prefix,
        where: "desired_content_token IS DISTINCT FROM synced_content_token",
        name: :mention_sync_pending_sources_index
      )
    )

    create table(:reference_map_revisions, primary_key: false, prefix: @prefix) do
      add(:community_id, references(:communities, on_delete: :delete_all), primary_key: true)
      add(:revision, :bigint, null: false, default: 0)

      timestamps()
    end
  end
end
