defmodule GroupherServer.Repo.Migrations.AlignReviewBotAndAlertWallNames do
  use Ecto.Migration

  @cms "cms"
  @wall "alert_wall"

  def up do
    rename_review_records()
    rename_review_blocks()
    rename_user_reports()
  end

  def down do
    raise "ReviewBot and AlertWall record names are not reverted"
  end

  defp rename_review_records do
    execute(
      "ALTER TABLE #{@cms}.review_requests DROP CONSTRAINT review_requests_version_ref_check"
    )

    execute("ALTER TABLE #{@cms}.review_requests RENAME TO artiment_reviews")
    execute("ALTER TABLE #{@cms}.artiment_reviews RENAME COLUMN review_ref TO subject_ref")
    execute("ALTER TABLE #{@cms}.artiment_reviews RENAME COLUMN superseded_at TO outdated_at")
    execute("ALTER TABLE #{@cms}.artiment_reviews DROP COLUMN article_revision_id")
    execute("ALTER TABLE #{@cms}.artiment_reviews DROP COLUMN comment_body_version")
    execute("ALTER TABLE #{@cms}.artiment_reviews DROP COLUMN branch_version_id")

    for index <- ~w(
      review_requests_current_article_community_index
      review_requests_current_article_system_index
      review_requests_current_comment_community_index
      review_requests_current_comment_system_index
      review_requests_current_doc_branch_index
      review_requests_review_ref_index
    ) do
      execute("DROP INDEX IF EXISTS #{@cms}.#{index}")
    end

    create_current_review_index(
      :artiment_reviews_current_article_community_index,
      "article",
      true
    )

    create_current_review_index(:artiment_reviews_current_article_system_index, "article", false)

    create_current_review_index(
      :artiment_reviews_current_comment_community_index,
      "comment",
      true
    )

    create_current_review_index(:artiment_reviews_current_comment_system_index, "comment", false)

    create(
      unique_index(:artiment_reviews, [:article_id, :branch_id],
        prefix: @cms,
        where: "target_type = 'doc' AND outdated_at IS NULL",
        name: :artiment_reviews_current_doc_branch_index
      )
    )

    create(index(:artiment_reviews, [:subject_ref], prefix: @cms))
  end

  defp create_current_review_index(name, target_type, community?) do
    target_column = if target_type == "article", do: :article_id, else: :comment_id
    columns = if community?, do: [target_column, :community_id], else: [target_column]
    community_filter = if community?, do: "community_id IS NOT NULL", else: "community_id IS NULL"

    create(
      unique_index(:artiment_reviews, columns,
        prefix: @cms,
        where: "target_type = '#{target_type}' AND outdated_at IS NULL AND #{community_filter}",
        name: name
      )
    )
  end

  defp rename_review_blocks do
    for type <- ~w(article comment doc) do
      old = "#{type}_review_restrictions"
      new = "#{type}_review_blocks"
      execute("ALTER TABLE #{@cms}.#{old} RENAME TO #{new}")
      execute("ALTER TABLE #{@cms}.#{new} RENAME COLUMN review_ref TO subject_ref")

      execute(
        "ALTER INDEX #{@cms}.#{old}_active_#{if type == "doc", do: "", else: "system_"}source_index RENAME TO #{new}_active_#{if type == "doc", do: "", else: "system_"}source_index"
      )

      if type != "doc" do
        execute(
          "ALTER INDEX #{@cms}.#{old}_active_community_source_index RENAME TO #{new}_active_community_source_index"
        )
      end
    end
  end

  defp rename_user_reports do
    execute("ALTER TABLE #{@wall}.reports RENAME TO user_reports")
    execute("ALTER TABLE #{@wall}.user_reports RENAME COLUMN origin_item_id TO item_id")
    execute("ALTER TABLE #{@wall}.user_reports ADD COLUMN outdated_at timestamptz")
    execute("ALTER TABLE #{@wall}.user_reports ADD COLUMN resolved_at timestamptz")
    execute("ALTER TABLE #{@wall}.user_reports ADD COLUMN resolution text")
    execute("DROP TABLE #{@wall}.item_reports")
    execute("DROP INDEX #{@wall}.alert_wall_reports_active_community_unique")
    execute("DROP INDEX #{@wall}.alert_wall_reports_active_system_unique")

    execute(
      "ALTER INDEX #{@wall}.reports_operation_ref_index RENAME TO user_reports_operation_ref_index"
    )

    execute(
      "ALTER INDEX #{@wall}.reports_reporter_id_inserted_at_id_index RENAME TO user_reports_reporter_id_inserted_at_id_index"
    )

    create(
      constraint(:user_reports, :alert_wall_user_reports_resolution_check,
        check:
          "(resolved_at IS NULL AND resolution IS NULL) OR (resolved_at IS NOT NULL AND resolution IS NOT NULL)",
        prefix: @wall
      )
    )

    create(
      unique_index(
        :user_reports,
        [:reporter_id, :owner, :target_type, :target_id, :community_id, :subject_ref],
        prefix: @wall,
        where:
          "withdrawn_at IS NULL AND outdated_at IS NULL AND resolved_at IS NULL AND community_id IS NOT NULL",
        name: :alert_wall_user_reports_active_community_unique
      )
    )

    create(
      unique_index(:user_reports, [:reporter_id, :owner, :target_type, :target_id, :subject_ref],
        prefix: @wall,
        where:
          "withdrawn_at IS NULL AND outdated_at IS NULL AND resolved_at IS NULL AND community_id IS NULL",
        name: :alert_wall_user_reports_active_system_unique
      )
    )
  end
end
