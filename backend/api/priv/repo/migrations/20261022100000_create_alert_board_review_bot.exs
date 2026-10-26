defmodule GroupherServer.Repo.Migrations.CreateAlertBoardReviewBot do
  use Ecto.Migration

  @alert_board "alert_board"
  @review_bot "review_bot"
  @cms "cms"
  @account "account"

  def up do
    execute("CREATE SCHEMA IF NOT EXISTS #{@alert_board}")
    execute("CREATE SCHEMA IF NOT EXISTS #{@review_bot}")

    create table(:rule_sets, prefix: @alert_board) do
      add(:scope_key, :text, null: false)
      add(:version, :bigint, null: false)
      add(:rules, :map, null: false, default: fragment("'{\"items\":[]}'::jsonb"))
      add(:prompt, :text)
      add(:provider_profile, :text)
      add(:required_modalities, {:array, :text}, null: false, default: [])
      add(:created_by_id, references(:users, prefix: @account, on_delete: :restrict), null: false)
      add(:operation_ref, :uuid, null: false)
      timestamps()
    end

    create(unique_index(:rule_sets, [:scope_key, :version], prefix: @alert_board))
    create(unique_index(:rule_sets, [:operation_ref], prefix: @alert_board))

    create table(:review_configs, prefix: @alert_board) do
      add(:scope_key, :text, null: false)
      add(:community_id, references(:communities, prefix: @cms, on_delete: :restrict))
      add(:subject_kind, :text, null: false)
      add(:version, :bigint, null: false, default: 1)
      add(:publish_mode, :text, null: false, default: "immediate")
      add(:edit_mode, :text, null: false, default: "immediate")
      add(:background_check, :boolean, null: false, default: false)
      add(:ruleset_id, references(:rule_sets, prefix: @alert_board, on_delete: :restrict))
      timestamps()
    end

    create(unique_index(:review_configs, [:scope_key, :subject_kind], prefix: @alert_board))

    create(
      constraint(:review_configs, :review_configs_subject_kind_check,
        check: "subject_kind IN ('article', 'comment', 'doc')",
        prefix: @alert_board
      )
    )

    create(
      constraint(:review_configs, :review_configs_scope_check,
        check:
          "(scope_key = 'platform' AND community_id IS NULL) OR " <>
            "(community_id IS NOT NULL AND scope_key = 'community:' || community_id::text)",
        prefix: @alert_board
      )
    )

    create(
      constraint(:review_configs, :review_configs_doc_scope_check,
        check: "subject_kind <> 'doc' OR scope_key = 'platform'",
        prefix: @alert_board
      )
    )

    execute("""
    INSERT INTO #{@alert_board}.review_configs
      (scope_key, community_id, subject_kind, version, publish_mode, edit_mode,
       background_check, inserted_at, updated_at)
    VALUES
      ('platform', NULL, 'article', 1, 'immediate', 'immediate', false, now(), now()),
      ('platform', NULL, 'comment', 1, 'immediate', 'immediate', false, now(), now()),
      ('platform', NULL, 'doc', 1, 'immediate', 'immediate', false, now(), now())
    """)

    execute("""
    INSERT INTO #{@alert_board}.review_configs
      (scope_key, community_id, subject_kind, version, publish_mode, edit_mode,
       background_check, inserted_at, updated_at)
    SELECT 'community:' || community.id::text, community.id, subject.subject_kind,
           1, 'immediate', 'immediate', false, now(), now()
    FROM #{@cms}.communities AS community
    CROSS JOIN (VALUES ('article'), ('comment')) AS subject(subject_kind)
    """)

    create table(:cases, prefix: @alert_board) do
      add(:target_key, :text, null: false)
      add(:article_id, references(:articles, prefix: @cms, type: :uuid, on_delete: :restrict))
      add(:comment_id, references(:comments, prefix: @cms, on_delete: :restrict))
      add(:user_id, references(:users, prefix: @account, on_delete: :restrict))
      add(:branch_id, references(:doc_branches, prefix: @cms, on_delete: :restrict))
      add(:scope_key, :text, null: false)
      add(:content_token, :text, null: false)
      add(:status, :text, null: false, default: "open")
      add(:priority, :text, null: false, default: "normal")
      add(:resolution, :text)
      add(:version, :bigint, null: false, default: 1)
      add(:opened_at, :timestamptz, null: false)
      add(:resolved_at, :timestamptz)
      timestamps()
    end

    create(
      constraint(:cases, :cases_single_target_check,
        check: "num_nonnulls(article_id, comment_id, user_id) = 1",
        prefix: @alert_board
      )
    )

    create(
      constraint(:cases, :cases_target_key_check,
        check:
          "(article_id IS NOT NULL AND branch_id IS NULL AND target_key = 'article:' || article_id::text) OR " <>
            "(article_id IS NOT NULL AND branch_id IS NOT NULL AND target_key = 'doc:' || article_id::text || ':' || branch_id::text) OR " <>
            "(comment_id IS NOT NULL AND target_key = 'comment:' || comment_id::text) OR " <>
            "(user_id IS NOT NULL AND target_key = 'user:' || user_id::text)",
        prefix: @alert_board
      )
    )

    create(
      constraint(:cases, :cases_status_check,
        check: "status IN ('open', 'resolved', 'superseded')",
        prefix: @alert_board
      )
    )

    create(
      unique_index(:cases, [:target_key, :scope_key, :content_token],
        prefix: @alert_board,
        where: "status = 'open'",
        name: :cases_one_open_target_scope_token_index
      )
    )

    create(
      index(:cases, [:scope_key, :status, :priority, :inserted_at, :id], prefix: @alert_board)
    )

    create table(:reports, prefix: @alert_board) do
      add(:target_key, :text, null: false)
      add(:article_id, references(:articles, prefix: @cms, type: :uuid, on_delete: :restrict))
      add(:comment_id, references(:comments, prefix: @cms, on_delete: :restrict))
      add(:user_id, references(:users, prefix: @account, on_delete: :restrict))
      add(:branch_id, references(:doc_branches, prefix: @cms, on_delete: :restrict))
      add(:scope_key, :text, null: false)
      add(:content_token, :text, null: false)
      add(:reporter_id, references(:users, prefix: @account, on_delete: :restrict), null: false)
      add(:case_id, references(:cases, prefix: @alert_board, on_delete: :restrict), null: false)
      add(:reason_code, :text, null: false)
      add(:details, :text)
      add(:operation_ref, :uuid, null: false)
      add(:withdrawn_at, :timestamptz)
      timestamps()
    end

    create(
      constraint(:reports, :reports_single_target_check,
        check: "num_nonnulls(article_id, comment_id, user_id) = 1",
        prefix: @alert_board
      )
    )

    create(
      constraint(:reports, :reports_target_key_check,
        check:
          "(article_id IS NOT NULL AND branch_id IS NULL AND target_key = 'article:' || article_id::text) OR " <>
            "(article_id IS NOT NULL AND branch_id IS NOT NULL AND target_key = 'doc:' || article_id::text || ':' || branch_id::text) OR " <>
            "(comment_id IS NOT NULL AND target_key = 'comment:' || comment_id::text) OR " <>
            "(user_id IS NOT NULL AND target_key = 'user:' || user_id::text)",
        prefix: @alert_board
      )
    )

    create(
      unique_index(:reports, [:target_key, :scope_key, :reporter_id],
        prefix: @alert_board,
        where: "withdrawn_at IS NULL",
        name: :reports_one_active_per_reporter_index
      )
    )

    create(unique_index(:reports, [:operation_ref], prefix: @alert_board))
    create(index(:reports, [:case_id, :withdrawn_at], prefix: @alert_board))
    create(index(:reports, [:reporter_id, :inserted_at, :id], prefix: @alert_board))

    create table(:decisions, prefix: @alert_board) do
      add(:case_id, references(:cases, prefix: @alert_board, on_delete: :restrict))
      add(:target_key, :text, null: false)
      add(:scope_key, :text, null: false)
      add(:content_token, :text, null: false)
      add(:action, :text, null: false)
      add(:source, :text, null: false)
      add(:actor_id, references(:users, prefix: @account, on_delete: :restrict))
      add(:check_id, :uuid)
      add(:restriction_ids, {:array, :uuid}, null: false, default: [])
      add(:reason_code, :text)
      add(:note, :text)
      add(:operation_ref, :uuid, null: false)
      add(:expected_case_version, :bigint)
      timestamps()
    end

    create(
      constraint(:decisions, :decisions_actor_source_check,
        check:
          "(source = 'human' AND actor_id IS NOT NULL) OR (source = 'policy' AND check_id IS NOT NULL)",
        prefix: @alert_board
      )
    )

    create(unique_index(:decisions, [:operation_ref], prefix: @alert_board))

    create table(:checks, prefix: @review_bot, primary_key: false) do
      add(:id, :uuid, primary_key: true)
      add(:target_key, :text, null: false)
      add(:scope_key, :text, null: false)
      add(:content_token, :text, null: false)

      add(:ruleset_id, references(:rule_sets, prefix: @alert_board, on_delete: :restrict),
        null: false
      )

      add(:config_version, :bigint, null: false)
      add(:generation, :integer, null: false, default: 1)
      add(:trigger, :text, null: false)
      add(:state, :text, null: false, default: "queued")
      add(:result, :text)
      add(:coverage, :map, null: false, default: fragment("'{}'::jsonb"))
      add(:signals, :map, null: false, default: fragment("'{\"items\":[]}'::jsonb"))
      add(:payload, :map)
      add(:payload_expires_at, :timestamptz)
      add(:active_attempt, :integer, null: false, default: 0)
      add(:human_epoch, :bigint, null: false, default: 0)
      add(:operation_ref, :uuid, null: false)
      timestamps()
    end

    execute(
      "ALTER TABLE #{@alert_board}.decisions " <>
        "ADD CONSTRAINT decisions_check_id_fkey FOREIGN KEY (check_id) " <>
        "REFERENCES #{@review_bot}.checks(id) ON DELETE RESTRICT"
    )

    execute(
      "ALTER TABLE #{@review_bot}.checks ADD CONSTRAINT checks_state_check " <>
        "CHECK (state IN ('queued', 'running', 'completed', 'failed', 'superseded'))"
    )

    create(
      unique_index(:checks, [:target_key, :scope_key, :content_token, :ruleset_id, :generation],
        prefix: @review_bot,
        name: :checks_identity_index
      )
    )

    create(unique_index(:checks, [:operation_ref], prefix: @review_bot))
    create(index(:checks, [:state, :inserted_at], prefix: @review_bot))
    create(index(:checks, [:payload_expires_at], prefix: @review_bot))

    create table(:attempts, prefix: @review_bot) do
      add(
        :check_id,
        references(:checks, prefix: @review_bot, type: :uuid, on_delete: :restrict),
        null: false
      )

      add(:number, :integer, null: false)
      add(:state, :text, null: false)
      add(:started_at, :timestamptz, null: false)
      add(:finished_at, :timestamptz)
      add(:provider_profile, :text, null: false)
      add(:request_id, :uuid, null: false)
      add(:error_code, :text)
      add(:latency_ms, :integer)
      timestamps()
    end

    create(unique_index(:attempts, [:check_id, :number], prefix: @review_bot))
    create(unique_index(:attempts, [:request_id], prefix: @review_bot))
  end

  def down do
    drop_if_exists(table(:attempts, prefix: @review_bot))
    drop_if_exists(table(:decisions, prefix: @alert_board))
    drop_if_exists(table(:checks, prefix: @review_bot))
    drop_if_exists(table(:reports, prefix: @alert_board))
    drop_if_exists(table(:cases, prefix: @alert_board))
    drop_if_exists(table(:review_configs, prefix: @alert_board))
    drop_if_exists(table(:rule_sets, prefix: @alert_board))
    execute("DROP SCHEMA IF EXISTS #{@review_bot}")
    execute("DROP SCHEMA IF EXISTS #{@alert_board}")
  end
end
