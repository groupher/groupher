defmodule GroupherServer.Repo.Migrations.PreserveReviewHistoryOnTargetDelete do
  use Ecto.Migration

  @alert_board "alert_board"
  @cms "cms"

  def up do
    alter table(:cases, prefix: @alert_board) do
      add(:target_deleted_at, :timestamptz)
    end

    alter table(:reports, prefix: @alert_board) do
      add(:target_deleted_at, :timestamptz)
    end

    for table_name <- [:cases, :reports],
        column <- [:article_id, :comment_id, :user_id, :branch_id] do
      execute(
        "ALTER TABLE #{@alert_board}.#{table_name} DROP CONSTRAINT #{table_name}_#{column}_fkey"
      )

      execute("""
      ALTER TABLE #{@alert_board}.#{table_name}
      ADD CONSTRAINT #{table_name}_#{column}_fkey
      FOREIGN KEY (#{column}) REFERENCES #{target_schema(column)}.#{target_table(column)}(id) ON DELETE SET NULL
      """)
    end

    for table_name <- [:cases, :reports] do
      execute(
        "ALTER TABLE #{@alert_board}.#{table_name} DROP CONSTRAINT #{table_name}_single_target_check"
      )

      execute(
        "ALTER TABLE #{@alert_board}.#{table_name} DROP CONSTRAINT #{table_name}_target_key_check"
      )

      execute("""
      ALTER TABLE #{@alert_board}.#{table_name}
      ADD CONSTRAINT #{table_name}_single_target_check CHECK (
        num_nonnulls(article_id, comment_id, user_id) = 1 OR
        (target_deleted_at IS NOT NULL AND num_nonnulls(article_id, comment_id, user_id) = 0) OR
        (target_deleted_at IS NOT NULL AND article_id IS NOT NULL AND
         comment_id IS NULL AND user_id IS NULL AND branch_id IS NULL AND
         target_key LIKE 'doc:%')
      )
      """)

      execute("""
      ALTER TABLE #{@alert_board}.#{table_name}
      ADD CONSTRAINT #{table_name}_target_key_check CHECK (
        (article_id IS NOT NULL AND branch_id IS NULL AND target_key = 'article:' || article_id::text) OR
        (article_id IS NOT NULL AND branch_id IS NOT NULL AND target_key = 'doc:' || article_id::text || ':' || branch_id::text) OR
        (comment_id IS NOT NULL AND target_key = 'comment:' || comment_id::text) OR
        (user_id IS NOT NULL AND target_key = 'user:' || user_id::text) OR
        (target_deleted_at IS NOT NULL AND branch_id IS NULL AND
         ((num_nonnulls(article_id, comment_id, user_id) = 0) OR
          (article_id IS NOT NULL AND comment_id IS NULL AND user_id IS NULL AND target_key LIKE 'doc:%')))
      )
      """)
    end

    for table_name <- [
          :article_review_restrictions,
          :comment_review_restrictions,
          :doc_review_restrictions
        ] do
      execute("ALTER TABLE #{@cms}.#{table_name} DROP CONSTRAINT #{table_name}_lifecycle_id_fkey")

      lifecycle_table = lifecycle_table(table_name)

      execute("""
      ALTER TABLE #{@cms}.#{table_name}
      ADD CONSTRAINT #{table_name}_lifecycle_id_fkey
      FOREIGN KEY (lifecycle_id) REFERENCES #{@cms}.#{lifecycle_table}(id) ON DELETE CASCADE
      """)
    end

    execute(tombstone_function())

    for {table_name, kind} <- [
          {:articles, "article"},
          {:comments, "comment"},
          {:users, "user"},
          {:doc_branches, "branch"}
        ] do
      schema = if table_name == :users, do: "account", else: @cms

      execute("""
      CREATE TRIGGER #{table_name}_tombstone_review_targets
      BEFORE DELETE ON #{schema}.#{table_name}
      FOR EACH ROW EXECUTE FUNCTION #{@cms}.tombstone_review_target('#{kind}')
      """)
    end
  end

  def down do
    # Historical review facts are not reversible after a target has been deleted.
    raise "PreserveReviewHistoryOnTargetDelete is irreversible"
  end

  defp target_table(:article_id), do: "articles"
  defp target_table(:comment_id), do: "comments"
  defp target_table(:user_id), do: "users"
  defp target_table(:branch_id), do: "doc_branches"

  defp target_schema(:user_id), do: "account"
  defp target_schema(_column), do: @cms

  defp lifecycle_table(:article_review_restrictions), do: "article_lifecycles"
  defp lifecycle_table(:comment_review_restrictions), do: "comment_lifecycles"
  defp lifecycle_table(:doc_review_restrictions), do: "doc_lifecycles"

  defp tombstone_function do
    """
    CREATE FUNCTION #{@cms}.tombstone_review_target() RETURNS trigger AS $$
    DECLARE deleted_at_value timestamptz := clock_timestamp();
    BEGIN
      IF TG_ARGV[0] = 'article' THEN
        UPDATE #{@alert_board}.cases
        SET article_id = NULL, branch_id = NULL, target_deleted_at = deleted_at_value,
            status = CASE WHEN status = 'open' THEN 'superseded' ELSE status END,
            resolution = CASE WHEN status = 'open' THEN 'target_deleted' ELSE resolution END,
            resolved_at = CASE WHEN status = 'open' THEN COALESCE(resolved_at, deleted_at_value) ELSE resolved_at END,
            updated_at = deleted_at_value
        WHERE article_id = OLD.id;
        UPDATE #{@alert_board}.reports
        SET article_id = NULL, branch_id = NULL, target_deleted_at = deleted_at_value,
            updated_at = deleted_at_value
        WHERE article_id = OLD.id;
      ELSIF TG_ARGV[0] = 'comment' THEN
        UPDATE #{@alert_board}.cases
        SET comment_id = NULL, target_deleted_at = deleted_at_value,
            status = CASE WHEN status = 'open' THEN 'superseded' ELSE status END,
            resolution = CASE WHEN status = 'open' THEN 'target_deleted' ELSE resolution END,
            resolved_at = CASE WHEN status = 'open' THEN COALESCE(resolved_at, deleted_at_value) ELSE resolved_at END,
            updated_at = deleted_at_value
        WHERE comment_id = OLD.id;
        UPDATE #{@alert_board}.reports
        SET comment_id = NULL, target_deleted_at = deleted_at_value,
            updated_at = deleted_at_value
        WHERE comment_id = OLD.id;
      ELSIF TG_ARGV[0] = 'user' THEN
        UPDATE #{@alert_board}.cases
        SET user_id = NULL, target_deleted_at = deleted_at_value,
            status = CASE WHEN status = 'open' THEN 'superseded' ELSE status END,
            resolution = CASE WHEN status = 'open' THEN 'target_deleted' ELSE resolution END,
            resolved_at = CASE WHEN status = 'open' THEN COALESCE(resolved_at, deleted_at_value) ELSE resolved_at END,
            updated_at = deleted_at_value
        WHERE user_id = OLD.id;
        UPDATE #{@alert_board}.reports
        SET user_id = NULL, target_deleted_at = deleted_at_value,
            updated_at = deleted_at_value
        WHERE user_id = OLD.id;
      ELSIF TG_ARGV[0] = 'branch' THEN
        UPDATE #{@alert_board}.cases
        SET branch_id = NULL, target_deleted_at = deleted_at_value,
            status = CASE WHEN status = 'open' THEN 'superseded' ELSE status END,
            resolution = CASE WHEN status = 'open' THEN 'target_deleted' ELSE resolution END,
            resolved_at = CASE WHEN status = 'open' THEN COALESCE(resolved_at, deleted_at_value) ELSE resolved_at END,
            updated_at = deleted_at_value
        WHERE branch_id = OLD.id;
        UPDATE #{@alert_board}.reports
        SET branch_id = NULL, target_deleted_at = deleted_at_value,
            updated_at = deleted_at_value
        WHERE branch_id = OLD.id;
      END IF;

      RETURN OLD;
    END;
    $$ LANGUAGE plpgsql
    """
  end
end
