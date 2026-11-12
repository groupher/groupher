defmodule GroupherServer.Repo.Migrations.AddDocsApprovalPolicyActivity do
  use Ecto.Migration

  @actions ~w(blocker_created blocker_released blocker_terminated setup_failed setup_retried activated destroy_scheduled destroy_cancelled destroyed lifecycle_reconciled activity_exported)
  def up, do: replace(@actions ++ ["docs_approval_policy_changed"])
  def down, do: replace(@actions)

  defp replace(actions) do
    drop(constraint(:community_logs, :community_logs_action_check, prefix: "activity"))
    values = Enum.map_join(actions, ",", &"'#{&1}'")

    create(
      constraint(:community_logs, :community_logs_action_check,
        prefix: "activity",
        check: "action IN (#{values})"
      )
    )
  end
end
