defmodule GroupherServer.Repo.Migrations.AddPostTicketLinkActivity do
  use Ecto.Migration

  @original_actions ~w(created title_changed body_updated trashed restored archived permanently_deleted comment_created comment_updated comment_pinned comment_unpinned solution_accepted solution_replaced solution_revoked moderation_review_started moderation_review_resolved)
  @ticket_actions ~w(created ticket_created ticket_linked title_changed body_updated trashed restored archived permanently_deleted comment_created comment_updated comment_pinned comment_unpinned solution_accepted solution_replaced solution_revoked moderation_review_started moderation_review_resolved)

  def up do
    drop(constraint(:post_logs, "post_logs_action_check", prefix: "activity"))

    create(
      constraint(:post_logs, "post_logs_action_check",
        check: "action IN (#{quoted(@ticket_actions)})",
        prefix: "activity"
      )
    )
  end

  def down do
    drop(constraint(:post_logs, "post_logs_action_check", prefix: "activity"))

    create(
      constraint(:post_logs, "post_logs_action_check",
        check: "action IN (#{quoted(@original_actions)})",
        prefix: "activity"
      )
    )
  end

  defp quoted(values), do: Enum.map_join(values, ", ", &("'" <> &1 <> "'"))
end
