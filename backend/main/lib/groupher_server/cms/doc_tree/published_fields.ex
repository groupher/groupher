defmodule GroupherServer.CMS.DocTree.PublishedFields do
  @moduledoc """
  Single source of published doc-tree fields copied from staged events.

  Publish code uses this list when applying event payloads to public
  `doc_tree_nodes`. Keep it small and explicit so transient editor fields do not
  leak into the published tree snapshot.

  Business position:

      Dashboard / public Docs
        -> CMS.DocTree
        -> PublishedFields
        -> Repo / published projection
  """

  @node_fields ~w(type parent_node_id title index href marker badge hidden)a

  @doc "Returns the node fields copied from staged events to published tree nodes."
  def node_fields, do: @node_fields
end
