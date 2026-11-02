defmodule GroupherServer.Repo.Migrations.AlignTicketActivityActions do
  use Ecto.Migration

  @common ~w(created source_linked source_unlinked work_status_changed draft_saved published moved_to_draft)
  @legacy ~w(update_added update_superseded)
  @current ~w(public_update_published public_update_superseded)

  def up do
    replace_actions(@legacy, @current, "ticket_activity_legacy_update_actions_require_review")
  end

  def down do
    replace_actions(@current, @legacy, "ticket_activity_public_update_actions_prevent_rollback")
  end

  defp replace_actions(removed, added, failure) do
    # Preserve append-only history: never rename or reconstruct existing events.
    execute("LOCK TABLE activity.ticket_logs IN ACCESS EXCLUSIVE MODE")

    execute("""
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM activity.ticket_logs WHERE action IN (#{quoted(removed)})) THEN
        RAISE EXCEPTION '#{failure}';
      END IF;
    END;
    $$;
    """)

    execute("""
    ALTER TABLE activity.ticket_logs
      DROP CONSTRAINT ticket_logs_action_check,
      ADD CONSTRAINT ticket_logs_action_check
        CHECK (action IN (#{quoted(@common ++ added)}))
    """)
  end

  defp quoted(values), do: Enum.map_join(values, ", ", &("'" <> &1 <> "'"))
end
