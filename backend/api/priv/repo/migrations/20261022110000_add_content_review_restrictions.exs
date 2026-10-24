defmodule GroupherServer.Repo.Migrations.AddContentReviewRestrictions do
  use Ecto.Migration

  @cms "cms"
  @alert_board "alert_board"

  def up do
    for table_name <- [:article_lifecycles, :comment_lifecycles, :doc_lifecycles] do
      alter table(table_name, prefix: @cms) do
        add(:review_content_token, :text)
        add(:review_epoch, :bigint, null: false, default: 0)
      end
    end

    execute("""
    UPDATE cms.article_lifecycles
    SET review_content_token = 'legacy:article:' || article_id::text
    WHERE review_content_token IS NULL
    """)

    execute("""
    UPDATE cms.comment_lifecycles
    SET review_content_token = 'legacy:comment:' || comment_id::text
    WHERE review_content_token IS NULL
    """)

    execute("""
    UPDATE cms.doc_lifecycles
    SET review_content_token = 'legacy:doc:' || article_id::text || ':' || branch_id::text
    WHERE review_content_token IS NULL
    """)

    create_restrictions(:article_review_restrictions, :article_lifecycles)
    create_restrictions(:comment_review_restrictions, :comment_lifecycles)
    create_restrictions(:doc_review_restrictions, :doc_lifecycles)
  end

  def down do
    drop_if_exists(table(:doc_review_restrictions, prefix: @cms))
    drop_if_exists(table(:comment_review_restrictions, prefix: @cms))
    drop_if_exists(table(:article_review_restrictions, prefix: @cms))

    for table_name <- [:article_lifecycles, :comment_lifecycles, :doc_lifecycles] do
      alter table(table_name, prefix: @cms) do
        remove(:review_epoch)
        remove(:review_content_token)
      end
    end
  end

  defp create_restrictions(table_name, lifecycle_table) do
    create table(table_name, prefix: @cms) do
      add(:lifecycle_id, references(lifecycle_table, prefix: @cms, on_delete: :restrict),
        null: false
      )

      add(:scope_key, :text, null: false)
      add(:cause_key, :text, null: false)
      add(:kind, :text, null: false)
      add(:content_token, :text, null: false)
      add(:source, :text, null: false)
      add(:case_id, references(:cases, prefix: @alert_board, on_delete: :nilify_all))
      add(:check_id, references(:checks, prefix: "review_bot", type: :uuid, on_delete: :restrict))
      add(:created_by_operation_ref, :uuid, null: false)
      add(:applied_at, :timestamptz, null: false)
      add(:ended_at, :timestamptz)
      add(:ended_by_operation_ref, :uuid)
      add(:end_reason, :text)
      add(:version, :bigint, null: false, default: 1)
      timestamps()
    end

    create(
      constraint(table_name, :review_restriction_kind_check,
        check: "kind IN ('awaiting_ai', 'awaiting_human', 'rule_hit', 'manual_hold')",
        prefix: @cms
      )
    )

    create(
      constraint(table_name, :review_restriction_source_check,
        check: "source IN ('submission', 'policy', 'human')",
        prefix: @cms
      )
    )

    create(
      constraint(table_name, :review_restriction_end_fields_check,
        check:
          "(ended_at IS NULL AND ended_by_operation_ref IS NULL AND end_reason IS NULL) OR (ended_at IS NOT NULL AND ended_by_operation_ref IS NOT NULL AND end_reason IS NOT NULL)",
        prefix: @cms
      )
    )

    create(
      unique_index(table_name, [:lifecycle_id, :scope_key, :cause_key],
        prefix: @cms,
        where: "ended_at IS NULL",
        name: String.to_atom("#{table_name}_active_cause_index")
      )
    )

    create(
      index(table_name, [:lifecycle_id, :scope_key],
        prefix: @cms,
        where: "ended_at IS NULL"
      )
    )
  end
end
