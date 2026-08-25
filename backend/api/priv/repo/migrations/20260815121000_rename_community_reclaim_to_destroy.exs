defmodule GroupherServer.Repo.Migrations.RenameCommunityReclaimToDestroy do
  use Ecto.Migration

  @cms_prefix "cms"

  def up do
    execute("""
    UPDATE #{@cms_prefix}.community_lifecycles
    SET state = 'pending_destroy'
    WHERE state = 'scheduled_reclaim'
    """)

    drop(
      constraint(:community_lifecycles, :community_lifecycles_state_check, prefix: @cms_prefix)
    )

    create(
      constraint(:community_lifecycles, :community_lifecycles_state_check,
        prefix: @cms_prefix,
        check:
          "state IN ('setting_up', 'setup_failed', 'active', 'read_only', 'suspended', 'archived', 'pending_destroy', 'destroy')"
      )
    )

    rename(table(:community_lifecycles, prefix: @cms_prefix), :scheduled_reclaim_at,
      to: :destroy_scheduled_at
    )
  end

  def down do
    rename(table(:community_lifecycles, prefix: @cms_prefix), :destroy_scheduled_at,
      to: :scheduled_reclaim_at
    )

    execute("""
    UPDATE #{@cms_prefix}.community_lifecycles
    SET state = 'scheduled_reclaim'
    WHERE state = 'pending_destroy'
    """)

    drop(
      constraint(:community_lifecycles, :community_lifecycles_state_check, prefix: @cms_prefix)
    )

    create(
      constraint(:community_lifecycles, :community_lifecycles_state_check,
        prefix: @cms_prefix,
        check:
          "state IN ('setting_up', 'setup_failed', 'active', 'read_only', 'suspended', 'archived', 'scheduled_reclaim', 'destroy')"
      )
    )
  end
end
