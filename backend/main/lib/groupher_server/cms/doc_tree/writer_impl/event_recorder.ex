defmodule GroupherServer.CMS.DocTree.Writer.EventRecorder do
  @moduledoc """
  Records staged tree events and converts delete/discard counts into deltas.

      draft node mutation
          |
          v
      Events.create/update/move/delete event structs
          |
          +--> owner=doc  -> doc publish owns the created page shell
          +--> owner=tree -> tree publish owns explicit tree changes
          |
          v
      staged_event_count delta

      delete subtree
          |
          +--> discard staged create events for draft-only nodes
          +--> add delete event when a public node exists
          |
          v
      delta = new tree events - discarded tree events

  The returned count is intentionally tree-owner only because doc-owned create
  events are published together with article content.
  """

  import Ecto.Query, warn: false

  alias GroupherServer.{CMS, Repo}
  alias CMS.DocTree.Events
  alias CMS.Model.{Community, DocTreeNode}

  require CMS.Const

  def record_tree_events(%Community{} = community, branch, args, events) do
    with {:ok, events} <-
           Events.record_staged_many(community, events, Map.get(args, :actor_id),
             branch_id: branch.id
           ) do
      {:ok, Enum.count(events, &(&1.owner == CMS.Const.tree_event_owner(:tree)))}
    end
  end

  def record_delete_or_discard_tree_events(
        %Community{} = community,
        branch,
        args,
        %DocTreeNode{} = node,
        subtree
      ) do
    subtree_node_ids = Enum.map(subtree, & &1.node_id)

    discarded =
      Events.discard_tree_create_staged(community, subtree_node_ids, branch_id: branch.id)

    # The returned delta adjusts the tree staged counter: public subtrees add a
    # delete event, while draft-only creates are only discarded.
    if public_nodes_exist?(community, branch, subtree_node_ids) do
      with {:ok, event_count} <-
             record_tree_events(community, branch, args, [Events.delete_event(node, subtree)]) do
        {:ok, event_count - discarded}
      end
    else
      {:ok, -discarded}
    end
  end

  def doc_owned_create_event(%DocTreeNode{} = node) do
    node
    |> Events.create_event()
    |> Map.merge(%{owner: CMS.Const.tree_event_owner(:doc), doc_id: node.doc_id})
  end

  defp public_nodes_exist?(_community, _branch, []), do: false

  defp public_nodes_exist?(%Community{} = community, branch, node_ids) do
    node_ids = Enum.map(node_ids, &to_string/1)

    DocTreeNode
    |> where([n], n.community_id == ^community.id)
    |> where([n], n.branch_id == ^branch.id)
    |> where([n], n.stage == CMS.Const.stage(:public))
    |> where([n], n.node_id in ^node_ids)
    |> Repo.exists?()
  end
end
