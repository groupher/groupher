defmodule GroupherServer.Repo.Migrations.AddViewEventInvariants do
  use Ecto.Migration

  def up do
    create(
      constraint(:view_events, :view_events_projection_state_check,
        check: "counted = true OR projected_at IS NOT NULL",
        prefix: "cms"
      )
    )

    create(
      constraint(:view_events, :view_events_decision_check,
        check:
          "(counted = true AND decision_reason = 'counted') OR " <>
            "(counted = false AND decision_reason IN " <>
            "('duplicate_in_window', 'excluded_by_policy'))",
        prefix: "cms"
      )
    )
  end

  def down do
    drop(constraint(:view_events, :view_events_decision_check, prefix: "cms"))
    drop(constraint(:view_events, :view_events_projection_state_check, prefix: "cms"))
  end
end
