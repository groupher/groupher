defmodule GroupherServer.Activity.Model.DocLog do
  @moduledoc """
  Stores append-only branch-aware Activity events for Doc streams.

      Doc Activity contract -> activity.doc_logs -> safe surfaces
  """
  use GroupherServer.Activity.Model.Base,
    table: "doc_logs",
    stream_field: :doc_ref,
    extra_fields: [branch_ref: :string],
    actions: [
      :created,
      :title_changed,
      :body_updated,
      :draft_updated,
      :published,
      :publish_restored,
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
