defmodule GroupherServer.Repo.Migrations.RemoveLegacyMembershipAndBillingPlaceholders do
  use Ecto.Migration

  @account_prefix "account"
  @cms_prefix "cms"

  def up do
    alter table(:achievements, prefix: @account_prefix) do
      remove(:donate_member)
      remove(:senior_member)
      remove(:sponsor_member)
    end

    execute("""
    UPDATE #{@cms_prefix}.passports
    SET rules = rules #- '{global,system_accountant}'
    WHERE rules->'global' ? 'system_accountant'
    """)

    execute("""
    WITH removed AS (
      DELETE FROM #{@cms_prefix}.community_lifecycle_blockers
      WHERE blocker_type IN ('billing_read_only', 'billing_suspend')
      RETURNING lifecycle_id
    ), affected AS (
      SELECT DISTINCT lifecycle_id FROM removed
    )
    UPDATE #{@cms_prefix}.community_lifecycles AS lifecycle
    SET state = CASE
                  WHEN EXISTS (
                    SELECT 1
                    FROM #{@cms_prefix}.community_lifecycle_blockers AS blocker
                    WHERE blocker.lifecycle_id = lifecycle.id
                      AND blocker.ended_at IS NULL
                      AND blocker.blocker_type IN ('owner_archive', 'moderation_archive')
                  ) THEN 'archived'
                  WHEN EXISTS (
                    SELECT 1
                    FROM #{@cms_prefix}.community_lifecycle_blockers AS blocker
                    WHERE blocker.lifecycle_id = lifecycle.id
                      AND blocker.ended_at IS NULL
                      AND blocker.blocker_type = 'moderation_suspend'
                  ) THEN 'suspended'
                  ELSE 'active'
                END,
        changed_at = NOW(),
        updated_at = NOW(),
        version = lifecycle.version + 1
    WHERE lifecycle.id IN (SELECT lifecycle_id FROM affected)
    """)

    execute(
      "ALTER TABLE #{@cms_prefix}.community_lifecycle_blockers DROP CONSTRAINT IF EXISTS community_lifecycle_blockers_type_check"
    )

    execute("""
    ALTER TABLE #{@cms_prefix}.community_lifecycle_blockers
    ADD CONSTRAINT community_lifecycle_blockers_type_check
    CHECK (blocker_type IN ('owner_archive', 'moderation_suspend', 'moderation_archive', 'ops_legal_hold'))
    """)
  end

  def down do
    raise Ecto.MigrationError,
          "irreversible migration: legacy membership flags and billing blocker records were removed"
  end
end
