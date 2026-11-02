defmodule GroupherServer.Repo.Migrations.CreateTicketActivity do
  use Ecto.Migration

  @actions ~w(created source_linked source_unlinked work_status_changed draft_saved published moved_to_draft update_added update_superseded)

  def up do
    execute("CREATE TABLE activity.ticket_logs (LIKE activity.post_logs INCLUDING ALL)")
    execute("ALTER TABLE activity.ticket_logs DROP CONSTRAINT post_logs_action_check")

    execute("""
    ALTER TABLE activity.ticket_logs
      ADD CONSTRAINT ticket_logs_action_check
      CHECK (action IN (#{quoted(@actions)}))
    """)
  end

  def down do
    execute("DROP TABLE IF EXISTS activity.ticket_logs")
  end

  defp quoted(values), do: Enum.map_join(values, ", ", &("'" <> &1 <> "'"))
end
