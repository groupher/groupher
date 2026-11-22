defmodule GroupherServer.Activity.DocTree do
  @moduledoc """
  Owns DocTree lifecycle Activity actions and projections.

      DocTree command -> DocTree Activity contract -> DocTreeLog
  """

  alias GroupherServer.{Activity, CMS}
  alias Activity.Event
  alias Activity.Model.DocTreeLog
  alias CMS.Model.DocsTreeNode

  @contracts %{
    trashed: Event.contract([], [:node_count, :doc_count], [:community_log]),
    restored: Event.contract([], [:node_count, :doc_count], [:community_log]),
    permanently_deleted: Event.contract([], [:doc_count], [:community_log])
  }

  @doc """
  Returns DocTree's classified Activity contracts.

  ## Examples

      Activity.DocTree.contracts()[:trashed].classification
  """
  def contracts, do: Event.classify_contracts(@contracts)

  @doc """
  Returns the DocTree Activity log schema.

  ## Examples

      Activity.DocTree.schema()
  """
  def schema, do: DocTreeLog

  @doc """
  Returns the field used as the DocTree Activity stream reference.

  ## Examples

      Activity.DocTree.stream_field()
  """
  def stream_field, do: :doc_tree_ref

  @doc """
  Returns the public resource type used by DocTree Activity filters.

  ## Examples

      Activity.DocTree.resource_type()
  """
  def resource_type, do: :doc_tree

  @doc """
  Builds and persists a DocTree Activity event.

  ## Examples

      Activity.DocTree.log(node, :trashed, actor: actor)
  """
  def log(resource, action, opts), do: Event.log(__MODULE__, resource, action, opts)

  @doc """
  Projects a DocTree Activity row for a public surface.

  ## Examples

      Activity.DocTree.project(log, :community_log)
  """
  def project(log, surface), do: Event.project(__MODULE__, log, surface)

  @doc """
  Lists the DocTree actions exposed on a public Activity surface.

  ## Examples

      Activity.DocTree.surface_actions(:community_log)
  """
  def surface_actions(surface), do: Event.surface_actions(__MODULE__, surface)

  @doc """
  Describes a DocTree resource for an Activity event envelope.

  ## Examples

      Activity.DocTree.describe(node, :trashed, [])
  """
  def describe(%DocsTreeNode{} = node, _action, _opts) do
    {:ok, descriptor(node.community_id, node.node_id, node)}
  end

  def describe(%{activity_type: :doc_tree, community_id: id, ref: ref} = resource, _action, _opts) do
    {:ok, descriptor(id, ref, resource)}
  end

  def describe(_, _, _), do: {:error, Event.error("invalid Activity DocTree resource")}

  defp descriptor(id, ref, resource) do
    snapshot = Event.snapshot(resource, [:title, :type, :node_id])

    %{
      community_id: id,
      doc_tree_ref: Event.stringify(ref),
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
