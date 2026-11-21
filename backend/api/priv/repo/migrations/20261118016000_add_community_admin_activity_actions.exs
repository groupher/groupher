defmodule GroupherServer.Repo.Migrations.AddCommunityAdminActivityActions do
  use Ecto.Migration

  @existing ~w(blocker_created blocker_released blocker_terminated setup_failed setup_retried
               activated destroy_scheduled destroy_cancelled destroyed lifecycle_reconciled
               docs_approval_policy_changed activity_exported)
  @added ~w(admin_joined admin_removed admin_permissions_changed admin_request_created
            admin_request_decided admin_request_cancelled admin_request_expired)

  def up, do: replace_actions(@existing ++ @added)
  def down, do: replace_actions(@existing)

  defp replace_actions(actions) do
    values = Enum.map_join(actions, ", ", &"'#{&1}'")
    execute("ALTER TABLE activity.community_logs DROP CONSTRAINT community_logs_action_check")

    execute(
      "ALTER TABLE activity.community_logs ADD CONSTRAINT community_logs_action_check CHECK (action IN (#{values}))"
    )
  end
end
