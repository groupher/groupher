defmodule GroupherServer.Activity.Model.BlogLog do
  @moduledoc """
  Stores append-only Activity events for Blog streams.

      Blog Activity contract -> activity.blog_logs -> safe surfaces
  """
  use GroupherServer.Activity.Model.Base,
    table: "blog_logs",
    stream_field: :blog_ref,
    actions: [
      :created,
      :title_changed,
      :body_updated,
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
