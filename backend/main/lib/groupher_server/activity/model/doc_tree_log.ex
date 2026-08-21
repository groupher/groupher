defmodule GroupherServer.Activity.Model.DocTreeLog do
  @moduledoc """
  Stores append-only Activity events for DocTree streams.

      DocTree Activity contract -> activity.doc_tree_logs -> management surface
  """
  use GroupherServer.Activity.Model.Base,
    table: "doc_tree_logs",
    stream_field: :doc_tree_ref,
    extra_fields: [branch_ref: :string],
    actions: [:trashed, :restored, :permanently_deleted]
end
