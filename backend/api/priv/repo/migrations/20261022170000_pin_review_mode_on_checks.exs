defmodule GroupherServer.Repo.Migrations.PinReviewModeOnChecks do
  use Ecto.Migration

  @review_bot "review_bot"

  def up do
    alter table(:checks, prefix: @review_bot) do
      add(:mode, :text, null: false, default: "immediate")
    end

    create(
      constraint(:checks, :checks_mode_check,
        check: "mode IN ('immediate', 'ai_first', 'human_first')",
        prefix: @review_bot
      )
    )

    drop_if_exists(
      index(
        :checks,
        [:target_key, :scope_key, :content_token, :ruleset_id, :generation],
        prefix: @review_bot,
        name: :checks_identity_index
      )
    )

    create(
      unique_index(
        :checks,
        [:target_key, :scope_key, :content_token, :ruleset_id, :config_version, :generation],
        prefix: @review_bot,
        name: :checks_identity_index
      )
    )
  end

  def down do
    drop_if_exists(
      index(
        :checks,
        [:target_key, :scope_key, :content_token, :ruleset_id, :config_version, :generation],
        prefix: @review_bot,
        name: :checks_identity_index
      )
    )

    create(
      unique_index(:checks, [:target_key, :scope_key, :content_token, :ruleset_id, :generation],
        prefix: @review_bot,
        name: :checks_identity_index
      )
    )

    drop(constraint(:checks, :checks_mode_check, prefix: @review_bot))

    alter table(:checks, prefix: @review_bot) do
      remove(:mode)
    end
  end
end
