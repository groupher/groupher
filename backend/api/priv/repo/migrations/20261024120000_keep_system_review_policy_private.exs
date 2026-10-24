defmodule GroupherServer.Repo.Migrations.KeepSystemReviewPolicyPrivate do
  use Ecto.Migration

  @review_bot "review_bot"

  def up do
    execute(
      "ALTER TABLE #{@review_bot}.review_bot_configs ALTER COLUMN review_mode DROP NOT NULL"
    )

    execute(
      "UPDATE #{@review_bot}.review_bot_configs SET review_mode = NULL WHERE community_id IS NULL"
    )

    drop(
      constraint(:review_bot_configs, :review_bot_configs_review_mode_check, prefix: @review_bot)
    )

    drop(
      constraint(:review_bot_configs, :review_bot_configs_doc_scope_check, prefix: @review_bot)
    )

    create(
      constraint(:review_bot_configs, :review_bot_configs_review_mode_scope_check,
        check:
          "(community_id IS NULL AND review_mode IS NULL) OR " <>
            "(community_id IS NOT NULL AND review_mode IN ('immediate', 'ai_first', 'human_first'))",
        prefix: @review_bot
      )
    )

    create(
      constraint(:review_bot_configs, :review_bot_configs_doc_scope_check,
        check: "subject_type <> 'doc' OR (community_id IS NULL AND review_mode IS NULL)",
        prefix: @review_bot
      )
    )
  end

  def down do
    drop(
      constraint(:review_bot_configs, :review_bot_configs_doc_scope_check, prefix: @review_bot)
    )

    drop(
      constraint(:review_bot_configs, :review_bot_configs_review_mode_scope_check,
        prefix: @review_bot
      )
    )

    execute(
      "UPDATE #{@review_bot}.review_bot_configs SET review_mode = 'immediate' WHERE community_id IS NULL"
    )

    execute("ALTER TABLE #{@review_bot}.review_bot_configs ALTER COLUMN review_mode SET NOT NULL")

    create(
      constraint(:review_bot_configs, :review_bot_configs_review_mode_check,
        check: "review_mode IN ('immediate', 'ai_first', 'human_first')",
        prefix: @review_bot
      )
    )

    create(
      constraint(:review_bot_configs, :review_bot_configs_doc_scope_check,
        check: "subject_type <> 'doc' OR (community_id IS NULL AND review_mode = 'immediate')",
        prefix: @review_bot
      )
    )
  end
end
