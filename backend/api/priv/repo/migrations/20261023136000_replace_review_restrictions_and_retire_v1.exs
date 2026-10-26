defmodule GroupherServer.Repo.Migrations.ReplaceReviewRestrictionsAndRetireV1 do
  use Ecto.Migration

  @cms "cms"
  @alert_board "alert_board"
  @alert_wall "alert_wall"
  @restriction_tables ~w(article_review_restrictions comment_review_restrictions doc_review_restrictions)

  def up do
    assert_cutover_safe!()
    drop_v1_target_tombstone_triggers()

    for table <- @restriction_tables do
      drop_if_exists(table(table, prefix: @cms))
    end

    drop_v1_review_storage()
    remove_lifecycle_review_identity()
    create_article_restrictions()
    create_comment_restrictions()
    create_doc_restrictions()
  end

  defp drop_v1_target_tombstone_triggers do
    for {schema, table} <- [
          {@cms, "articles"},
          {@cms, "comments"},
          {@cms, "doc_branches"},
          {"account", "users"}
        ] do
      execute("DROP TRIGGER IF EXISTS #{table}_tombstone_review_targets ON #{schema}.#{table}")
    end

    execute("DROP FUNCTION IF EXISTS #{@cms}.tombstone_review_target()")
  end

  def down do
    raise "ReviewBot V2 replaces V1 review storage without data conversion"
  end

  defp assert_cutover_safe! do
    active =
      Enum.reduce(@restriction_tables, 0, fn table, count ->
        count + scalar!("SELECT count(*) FROM #{@cms}.#{table} WHERE ended_at IS NULL")
      end)

    pending =
      scalar!("""
      SELECT count(*) FROM #{@alert_board}.cases AS review_case
      WHERE review_case.status = 'open'
        AND (review_case.target_key LIKE 'article:%' OR review_case.target_key LIKE 'comment:%' OR review_case.target_key LIKE 'doc:%')
        AND NOT EXISTS (
          SELECT 1 FROM #{@alert_board}.reports AS report
          WHERE report.case_id = review_case.id AND report.withdrawn_at IS NULL
        )
        AND NOT EXISTS (
          SELECT 1 FROM #{@alert_board}.decisions AS decision
          WHERE decision.case_id = review_case.id
        )
      """)

    if active != 0 or pending != 0 do
      raise "ReviewBot V2 cutover requires zero active V1 restrictions and pending content reviews (active=#{active}, pending=#{pending})"
    end
  end

  defp scalar!(sql) do
    %{rows: [[value]]} = repo().query!(sql)
    value
  end

  defp drop_v1_review_storage do
    for table <- ~w(attempts decisions checks reports cases review_configs rule_sets) do
      prefix = if table in ~w(attempts checks), do: "review_bot", else: "alert_board"
      execute("DROP TABLE IF EXISTS #{prefix}.#{table} CASCADE")
    end

    execute("DROP SCHEMA IF EXISTS alert_board")
  end

  defp remove_lifecycle_review_identity do
    for table <- [:article_lifecycles, :comment_lifecycles, :doc_lifecycles] do
      alter table(table, prefix: @cms) do
        remove(:review_epoch)
        remove(:review_content_token)
      end
    end
  end

  defp create_article_restrictions do
    create table(:article_review_restrictions, prefix: @cms) do
      add(:article_id, references(:articles, prefix: @cms, type: :uuid, on_delete: :delete_all),
        null: false
      )

      add(:community_id, references(:communities, prefix: @cms, on_delete: :restrict))
      add(:type, :text, null: false)

      add(
        :request_id,
        references(:review_requests, prefix: @cms, type: :uuid, on_delete: :restrict)
      )

      add(:item_id, references(:items, prefix: @alert_wall, on_delete: :restrict))
      add(:review_ref, :uuid)
      add(:source_ref, :text, null: false)
      add(:source, :text, null: false)
      add(:applied_at, :timestamptz, null: false)
      add(:resolved_at, :timestamptz)
      add(:resolved_by_ref, :uuid)
      add(:resolution, :text)
      add(:version, :bigint, null: false, default: 1)
      timestamps()
    end

    create_restriction_constraints(:article_review_restrictions, "article_id IS NOT NULL")

    create_target_indexes(:article_review_restrictions, [:article_id], [
      :article_id,
      :community_id
    ])
  end

  defp create_comment_restrictions do
    create table(:comment_review_restrictions, prefix: @cms) do
      add(:comment_id, references(:comments, prefix: @cms, on_delete: :delete_all), null: false)
      add(:community_id, references(:communities, prefix: @cms, on_delete: :restrict))
      add(:type, :text, null: false)

      add(
        :request_id,
        references(:review_requests, prefix: @cms, type: :uuid, on_delete: :restrict)
      )

      add(:item_id, references(:items, prefix: @alert_wall, on_delete: :restrict))
      add(:review_ref, :uuid)
      add(:source_ref, :text, null: false)
      add(:source, :text, null: false)
      add(:applied_at, :timestamptz, null: false)
      add(:resolved_at, :timestamptz)
      add(:resolved_by_ref, :uuid)
      add(:resolution, :text)
      add(:version, :bigint, null: false, default: 1)
      timestamps()
    end

    create_restriction_constraints(:comment_review_restrictions, "comment_id IS NOT NULL")

    create_target_indexes(:comment_review_restrictions, [:comment_id], [
      :comment_id,
      :community_id
    ])
  end

  defp create_doc_restrictions do
    create table(:doc_review_restrictions, prefix: @cms) do
      add(:article_id, references(:articles, prefix: @cms, type: :uuid, on_delete: :delete_all),
        null: false
      )

      add(:branch_id, references(:doc_branches, prefix: @cms, on_delete: :delete_all),
        null: false
      )

      add(:type, :text, null: false)

      add(
        :request_id,
        references(:review_requests, prefix: @cms, type: :uuid, on_delete: :restrict)
      )

      add(:item_id, references(:items, prefix: @alert_wall, on_delete: :restrict))
      add(:review_ref, :uuid)
      add(:source_ref, :text, null: false)
      add(:source, :text, null: false)
      add(:applied_at, :timestamptz, null: false)
      add(:resolved_at, :timestamptz)
      add(:resolved_by_ref, :uuid)
      add(:resolution, :text)
      add(:version, :bigint, null: false, default: 1)
      timestamps()
    end

    create_restriction_constraints(
      :doc_review_restrictions,
      "article_id IS NOT NULL AND branch_id IS NOT NULL"
    )

    create(
      unique_index(:doc_review_restrictions, [:article_id, :branch_id, :source_ref],
        prefix: @cms,
        where: "resolved_at IS NULL",
        name: :doc_review_restrictions_active_source_index
      )
    )

    create(index(:doc_review_restrictions, [:article_id, :branch_id, :resolved_at], prefix: @cms))
  end

  defp create_restriction_constraints(table_name, target_check) do
    create(
      constraint(table_name, :cms_review_restriction_type_check,
        check: "type IN ('awaiting_ai', 'awaiting_human', 'ai_suspect', 'manual_hold')",
        prefix: @cms
      )
    )

    create(
      constraint(table_name, :cms_review_restriction_source_check,
        check: "source IN ('request', 'human', 'domain')",
        prefix: @cms
      )
    )

    create(
      constraint(table_name, :cms_review_restriction_resolution_check,
        check:
          "(resolved_at IS NULL AND resolved_by_ref IS NULL AND resolution IS NULL) OR (resolved_at IS NOT NULL AND resolved_by_ref IS NOT NULL AND resolution IS NOT NULL)",
        prefix: @cms
      )
    )

    create(
      constraint(table_name, :cms_review_restriction_version_check,
        check: "version > 0 AND #{target_check}",
        prefix: @cms
      )
    )
  end

  defp create_target_indexes(table_name, system_columns, community_columns) do
    create(
      unique_index(table_name, system_columns ++ [:source_ref],
        prefix: @cms,
        where: "community_id IS NULL AND resolved_at IS NULL",
        name: String.to_atom("#{table_name}_active_system_source_index")
      )
    )

    create(
      unique_index(table_name, community_columns ++ [:source_ref],
        prefix: @cms,
        where: "community_id IS NOT NULL AND resolved_at IS NULL",
        name: String.to_atom("#{table_name}_active_community_source_index")
      )
    )

    create(index(table_name, system_columns ++ [:community_id, :resolved_at], prefix: @cms))
  end
end
