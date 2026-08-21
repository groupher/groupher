defmodule GroupherServer.Activity.DocTree do
  @moduledoc """
  Owns DocTree lifecycle Activity actions and projections.

      DocTree command -> DocTree Activity contract -> DocTreeLog
  """
  alias GroupherServer.Activity.Event
  alias GroupherServer.Activity.Model.DocTreeLog
  alias GroupherServer.CMS.Model.DocTreeNode

  @contracts %{
    trashed: Event.contract([], [:node_count, :doc_count], [:community_log]),
    restored:
      Event.contract([], [:node_count, :doc_count, :legacy_publish_restore], [:community_log]),
    permanently_deleted: Event.contract([], [:doc_count], [:community_log])
  }

  def contracts, do: @contracts
  def schema, do: DocTreeLog
  def stream_field, do: :doc_tree_ref
  def resource_type, do: :doc_tree
  def log(resource, action, opts), do: Event.log(__MODULE__, resource, action, opts)
  def project(log, surface), do: Event.project(__MODULE__, log, surface)
  def surface_actions(surface), do: Event.surface_actions(__MODULE__, surface)

  def describe(%DocTreeNode{} = node, _action, _opts) do
    {:ok, descriptor(node.community_id, node.node_id, node.branch_id, node)}
  end

  def describe(%{activity_type: :doc_tree, community_id: id, ref: ref} = resource, _action, _opts) do
    {:ok, descriptor(id, ref, Map.get(resource, :branch_ref), resource)}
  end

  def describe(_, _, _), do: {:error, Event.error("invalid Activity DocTree resource")}

  defp descriptor(id, ref, branch_ref, resource) do
    snapshot = Event.snapshot(resource, [:title, :type, :node_id])

    %{
      community_id: id,
      doc_tree_ref: Event.stringify(ref),
      branch_ref: Event.stringify(branch_ref),
      stream_snapshot: snapshot,
      subject_type: "doc_tree_node",
      subject_ref: Event.stringify(ref),
      subject_snapshot: snapshot,
      target_type: nil,
      target_ref: nil,
      target_snapshot: %{}
    }
  end
end
