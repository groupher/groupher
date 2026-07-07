defmodule GroupherServer.CMS.DocTree.PublishedFields do
  @moduledoc """
  Single source of published doc-tree fields copied from staged events.

  Publish code uses this list when applying event payloads to public
  `doc_tree_nodes`. Keep it small and explicit so transient editor fields do not
  leak into the published tree snapshot.
  """

  @node_fields ~w(type title slug index href marker badge hidden ui_config)a

  def node_fields, do: @node_fields
end
