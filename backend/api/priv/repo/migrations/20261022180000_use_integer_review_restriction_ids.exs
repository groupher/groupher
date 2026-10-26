defmodule GroupherServer.Repo.Migrations.UseIntegerReviewRestrictionIds do
  use Ecto.Migration

  @alert_board "alert_board"

  def up do
    execute("ALTER TABLE #{@alert_board}.decisions ALTER COLUMN restriction_ids DROP DEFAULT")

    execute("""
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM #{@alert_board}.decisions
        WHERE cardinality(restriction_ids) > 0
      ) THEN
        RAISE EXCEPTION 'review restriction IDs must be empty before changing their storage type';
      END IF;
    END $$;
    """)

    execute("""
    ALTER TABLE #{@alert_board}.decisions
    ALTER COLUMN restriction_ids TYPE bigint[] USING '{}'::bigint[]
    """)

    execute(
      "ALTER TABLE #{@alert_board}.decisions ALTER COLUMN restriction_ids SET DEFAULT '{}'::bigint[]"
    )
  end

  def down do
    execute("""
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM #{@alert_board}.decisions
        WHERE cardinality(restriction_ids) > 0
      ) THEN
        RAISE EXCEPTION 'cannot convert integer review restriction IDs back to UUIDs';
      END IF;
    END $$;
    """)

    execute("ALTER TABLE #{@alert_board}.decisions ALTER COLUMN restriction_ids DROP DEFAULT")

    execute("""
    ALTER TABLE #{@alert_board}.decisions
    ALTER COLUMN restriction_ids TYPE uuid[] USING '{}'::uuid[]
    """)

    execute(
      "ALTER TABLE #{@alert_board}.decisions ALTER COLUMN restriction_ids SET DEFAULT '{}'::uuid[]"
    )
  end
end
