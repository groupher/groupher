defmodule GroupherServer.Activity.Model.ChangelogLog do
  @moduledoc """
  Stores append-only Activity events for Changelog streams.

      Changelog Activity contract -> activity.changelog_logs -> safe surfaces
  """
  use GroupherServer.Activity.Model.Base,
    table: "changelog_logs",
    stream_field: :changelog_ref,
    actions: [
      :created,
      :title_changed,
      :body_updated,
      :released,
      :release_rescheduled,
      :release_withdrawn,
      :trashed,
      :restored,
      :archived,
      :permanently_deleted,
      :comment_created,
      :comment_updated,
      :moderation_review_started,
      :moderation_review_resolved
    ]
end
