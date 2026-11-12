defmodule GroupherServer.Activity.Model.DocLog do
  @moduledoc """
  Stores append-only stable Article Activity events for Doc streams.

      Doc Activity contract -> activity.doc_logs -> safe surfaces
  """

  use GroupherServer.Activity.Model.Base,
    table: "doc_logs",
    stream_field: :article_id,
    extra_fields: [],
    actions: [
      :created,
      :title_changed,
      :body_updated,
      :published,
      :trashed,
      :restored,
      :archived,
      :permanently_deleted,
      :comment_created,
      :comment_updated
    ]
end
