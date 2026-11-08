defmodule GroupherServer.Repo.Migrations.CreateMentionVersionFacts do
  @moduledoc """
  Creates stable Mention identities and immutable version facts.

      canonical source identity -> endpoint -> version set -> occurrences
  """

  use Ecto.Migration

  @prefix "cms"
  @internal_types "'post','blog','changelog','doc','ticket','comment'"

  def up do
    create table(:mention_endpoints, primary_key: false, prefix: @prefix) do
      add(:id, :uuid, primary_key: true)
      add(:type, :string, null: false)
      add(:article_id, :uuid)
      add(:comment_id, :bigint)
      add(:branch_id, :bigint)

      add(:parent_endpoint_id, references(:mention_endpoints, type: :uuid, on_delete: :restrict))

      add(:deleted_at, :timestamptz)
      timestamps()
    end

    create(
      constraint(:mention_endpoints, :mention_endpoint_identity_check,
        prefix: @prefix,
        check:
          "(type IN ('post','blog','changelog','ticket') AND article_id IS NOT NULL " <>
            "AND comment_id IS NULL AND branch_id IS NULL AND parent_endpoint_id IS NULL) OR " <>
            "(type = 'doc' AND article_id IS NOT NULL AND comment_id IS NULL " <>
            "AND branch_id IS NOT NULL AND parent_endpoint_id IS NULL) OR " <>
            "(type = 'comment' AND article_id IS NULL AND comment_id IS NOT NULL " <>
            "AND parent_endpoint_id IS NOT NULL)"
      )
    )

    create(unique_index(:mention_endpoints, [:id, :type], prefix: @prefix))

    create(
      unique_index(:mention_endpoints, [:type, :article_id],
        prefix: @prefix,
        where: "article_id IS NOT NULL AND branch_id IS NULL",
        name: :mention_endpoint_article_identity_index
      )
    )

    create(
      unique_index(:mention_endpoints, [:article_id, :branch_id],
        prefix: @prefix,
        where: "type = 'doc'",
        name: :mention_endpoint_doc_identity_index
      )
    )

    create(
      unique_index(:mention_endpoints, [:comment_id],
        prefix: @prefix,
        where: "type = 'comment'",
        name: :mention_endpoint_comment_identity_index
      )
    )

    create table(:mention_sets, primary_key: false, prefix: @prefix) do
      add(:id, :uuid, primary_key: true)

      add(:source_endpoint_id, references(:mention_endpoints, type: :uuid, on_delete: :restrict),
        null: false
      )

      add(:source_token, :text, null: false)
      add(:parser_version, :integer, null: false)
      timestamps()
    end

    create(
      constraint(:mention_sets, :mention_set_parser_version_check,
        prefix: @prefix,
        check: "parser_version > 0"
      )
    )

    create(
      unique_index(:mention_sets, [:source_endpoint_id, :source_token, :parser_version],
        prefix: @prefix,
        name: :mention_set_version_index
      )
    )

    create(unique_index(:mention_sets, [:id, :source_endpoint_id], prefix: @prefix))

    create table(:mention_occurrences, primary_key: false, prefix: @prefix) do
      add(:id, :uuid, primary_key: true)
      add(:set_id, references(:mention_sets, type: :uuid, on_delete: :delete_all), null: false)
      add(:occurrence_key, :text, null: false)
      add(:mention_case, :string, null: false)
      add(:target_type, :string, null: false)
      add(:target_endpoint_id, :uuid)
      add(:target_user_id, :bigint)
      add(:normalized_url, :text)
      add(:url_hash, :text)
      add(:editor_target_id, :text)
      add(:block_id, :text)
      add(:path, :text)
      add(:mentioned_at, :timestamptz, null: false)
      timestamps()
    end

    create(
      constraint(:mention_occurrences, :mention_occurrence_target_check,
        prefix: @prefix,
        check:
          "(target_type IN (#{@internal_types}) AND target_endpoint_id IS NOT NULL " <>
            "AND target_user_id IS NULL) OR " <>
            "(target_type = 'user' AND target_endpoint_id IS NULL " <>
            "AND target_user_id IS NOT NULL AND normalized_url IS NULL AND url_hash IS NULL) OR " <>
            "(target_type = 'url' AND target_endpoint_id IS NULL " <>
            "AND target_user_id IS NULL AND normalized_url IS NOT NULL AND url_hash IS NOT NULL)"
      )
    )

    create(
      constraint(:mention_occurrences, :mention_occurrence_case_check,
        prefix: @prefix,
        check: "mention_case IN ('inline_mention', 'link')"
      )
    )

    create(
      unique_index(:mention_occurrences, [:set_id, :occurrence_key],
        prefix: @prefix,
        name: :mention_occurrence_position_index
      )
    )

    execute("""
    ALTER TABLE cms.mention_occurrences
    ADD CONSTRAINT mention_occurrence_target_identity_fk
    FOREIGN KEY (target_endpoint_id, target_type)
    REFERENCES cms.mention_endpoints (id, type) ON DELETE RESTRICT
    """)
  end

  def down do
    drop(table(:mention_occurrences, prefix: @prefix))
    drop(table(:mention_sets, prefix: @prefix))
    drop(table(:mention_endpoints, prefix: @prefix))
  end
end
