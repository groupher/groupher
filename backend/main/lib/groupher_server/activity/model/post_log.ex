defmodule GroupherServer.Activity.Model.PostLog do
  @moduledoc """
  Stores append-only Activity events for Post streams.

      Post Activity contract -> activity.post_logs -> safe surfaces
  """
  use GroupherServer.Activity.Model.Base,
    table: "post_logs",
    stream_field: :post_ref,
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
      :comment_pinned,
      :comment_unpinned,
      :solution_accepted,
      :solution_replaced,
      :solution_revoked,
      :moderation_review_started,
      :moderation_review_resolved
    ]
end
