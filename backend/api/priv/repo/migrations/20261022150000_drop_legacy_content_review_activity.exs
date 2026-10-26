defmodule GroupherServer.Repo.Migrations.DropLegacyContentReviewActivity do
  use Ecto.Migration

  @prefix "activity"
  @tables [
    {:post_logs,
     ~w(created title_changed body_updated trashed restored archived permanently_deleted comment_created comment_updated comment_pinned comment_unpinned solution_accepted solution_replaced solution_revoked)},
    {:blog_logs,
     ~w(created title_changed body_updated trashed restored archived permanently_deleted comment_created comment_updated)},
    {:changelog_logs,
     ~w(created title_changed body_updated released release_rescheduled release_withdrawn trashed restored archived permanently_deleted comment_created comment_updated)},
    {:doc_logs,
     ~w(created title_changed body_updated draft_updated published publish_restored trashed restored archived permanently_deleted comment_created comment_updated)}
  ]

  def up do
    Enum.each(@tables, fn {table_name, actions} ->
      execute(
        "DELETE FROM #{@prefix}.#{table_name} WHERE action IN ('moderation_review_started', 'moderation_review_resolved')"
      )

      drop(constraint(table_name, :"#{table_name}_action_check", prefix: @prefix))

      create(
        constraint(table_name, :"#{table_name}_action_check",
          prefix: @prefix,
          check: "action IN (#{quoted(actions)})"
        )
      )
    end)
  end

  def down do
    raise "legacy content review Activity events are intentionally irreversible"
  end

  defp quoted(values), do: Enum.map_join(values, ", ", &("'" <> &1 <> "'"))
end
