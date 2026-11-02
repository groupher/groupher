defmodule GroupherServer.Repo.Migrations.RepairTicketActivityConstraints do
  use Ecto.Migration

  def up do
    execute("""
    ALTER TABLE activity.ticket_logs
      DROP CONSTRAINT post_logs_source_check,
      DROP CONSTRAINT post_logs_actor_type_check,
      DROP CONSTRAINT post_logs_outcome_check,
      DROP CONSTRAINT post_logs_outcome_rejection_check,
      ADD CONSTRAINT ticket_logs_source_check
        CHECK (source IN ('api', 'admin', 'worker', 'scheduler', 'maintenance', 'operations')),
      ADD CONSTRAINT ticket_logs_actor_type_check
        CHECK (actor_type IN ('user', 'system')),
      ADD CONSTRAINT ticket_logs_outcome_check
        CHECK (outcome IN ('allowed', 'denied')),
      ADD CONSTRAINT ticket_logs_outcome_rejection_check
        CHECK ((outcome = 'allowed' AND rejection_code IS NULL) OR
               (outcome = 'denied' AND rejection_code IS NOT NULL))
    """)
  end

  def down do
    execute("""
    ALTER TABLE activity.ticket_logs
      DROP CONSTRAINT ticket_logs_source_check,
      DROP CONSTRAINT ticket_logs_actor_type_check,
      DROP CONSTRAINT ticket_logs_outcome_check,
      DROP CONSTRAINT ticket_logs_outcome_rejection_check,
      ADD CONSTRAINT post_logs_source_check
        CHECK (source IN ('api', 'admin', 'worker', 'scheduler', 'maintenance', 'operations')),
      ADD CONSTRAINT post_logs_actor_type_check
        CHECK (actor_type IN ('user', 'system')),
      ADD CONSTRAINT post_logs_outcome_check
        CHECK (outcome IN ('allowed', 'denied')),
      ADD CONSTRAINT post_logs_outcome_rejection_check
        CHECK ((outcome = 'allowed' AND rejection_code IS NULL) OR
               (outcome = 'denied' AND rejection_code IS NOT NULL))
    """)
  end
end
