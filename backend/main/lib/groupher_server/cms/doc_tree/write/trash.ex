defmodule GroupherServer.CMS.DocTree.Write.Trash do
  @moduledoc """
  Moves deleted draft tree nodes into docs trash snapshots.

      delete_node
          |
          v
      subtree_nodes (computed once by caller)
          |
          +--> doc_tree_trash_items with node snapshot
          +--> optional draft doc + ArticleDocument snapshot
          +--> delete unreferenced draft docs
          +--> delete draft tree rows
          |
          v
      restore/publish can still explain or recover the deletion

  A duplicated page may share one draft doc with another node. This module only
  deletes draft docs that are no longer referenced by any remaining draft page.
  """

  import Ecto.Query, warn: false

  alias GroupherServer.{CMS, Repo}
  alias CMS.DocTree.{Events, Read, TrashSnapshot}

  alias CMS.Model.{
    Community,
    Doc,
    DocTreeNode,
    DocTreeTrashItem
  }

  alias Helper.ORM

  require CMS.Const

  @trash_snapshot_key_draft_doc CMS.Const.doc_tree_trash_snapshot_key(:draft_doc)

  @doc """
  Writes trash rows for the already-loaded deleted subtree nodes.
  """
  def trash_subtree(%Community{} = community, branch, nodes, actor_id) when is_list(nodes) do
    nodes
    |> Enum.reduce_while({:ok, []}, fn node, {:ok, acc} ->
      attrs = trash_attrs(community, branch, node, actor_id)

      case ORM.create(DocTreeTrashItem, attrs) do
        {:ok, item} -> {:cont, {:ok, [item | acc]}}
        error -> {:halt, error}
      end
    end)
    |> case do
      {:ok, items} -> {:ok, Enum.reverse(items)}
      error -> error
    end
  end

  @doc """
  Physically removes the already-loaded draft tree nodes.
  """
  def delete_subtree(nodes) when is_list(nodes) do
    nodes
    |> Enum.reduce_while(:ok, fn node, :ok ->
      case ORM.delete(node) do
        {:ok, _node} -> {:cont, :ok}
        error -> {:halt, error}
      end
    end)
  end

  @doc """
  Deletes draft docs that are no longer referenced after subtree removal.

  Shared draft docs survive when a duplicated page outside the deleted subtree
  still references the same stable `doc_id`.
  """
  def delete_subtree_doc_drafts(%Community{} = community, branch, nodes) when is_list(nodes) do
    subtree_node_ids = Enum.map(nodes, & &1.node_id)

    doc_ids =
      nodes
      |> subtree_doc_ids()
      |> unreferenced_doc_ids(community, branch, subtree_node_ids)

    case doc_ids do
      [] ->
        :ok

      doc_ids ->
        drafts = TrashSnapshot.draft_docs_by_doc_ids(community, branch, doc_ids)
        draft_ids = Enum.map(drafts, & &1.id)

        :ok = TrashSnapshot.delete_article_documents(drafts)

        Doc
        |> where([d], d.community_id == ^community.id)
        |> where([d], d.branch_id == ^branch.id)
        |> where([d], d.stage == CMS.Const.stage(:draft))
        |> where([d], d.id in ^draft_ids)
        |> Repo.delete_all()

        Events.discard_doc_bound_staged(community, doc_ids, branch_id: branch.id)
        :ok
    end
  end

  @doc """
  Loads the draft node subtree that should be deleted as one operation.
  """
  def subtree_nodes(%Community{} = community, branch, %DocTreeNode{type: :group} = group) do
    children =
      DocTreeNode
      |> where([n], n.community_id == ^community.id)
      |> where([n], n.branch_id == ^branch.id)
      |> where([n], n.stage == CMS.Const.stage(:draft))
      |> where([n], n.group_id == ^group.node_id)
      |> order_by([n], desc: n.index, desc: n.id)
      |> Repo.all()

    children ++ [group]
  end

  def subtree_nodes(%Community{} = community, branch, %DocTreeNode{type: :tab} = tab) do
    descendants =
      DocTreeNode
      |> where([n], n.community_id == ^community.id)
      |> where([n], n.branch_id == ^branch.id)
      |> where([n], n.stage == CMS.Const.stage(:draft))
      |> where([n], n.tab_id == ^tab.node_id)
      |> order_by([n], desc: n.index, desc: n.id)
      |> Repo.all()

    group_ids = descendants |> Enum.filter(&(&1.type == :group)) |> Enum.map(& &1.node_id)

    children =
      DocTreeNode
      |> where([n], n.community_id == ^community.id)
      |> where([n], n.branch_id == ^branch.id)
      |> where([n], n.stage == CMS.Const.stage(:draft))
      |> where([n], n.group_id in ^group_ids)
      |> order_by([n], desc: n.index, desc: n.id)
      |> Repo.all()

    children ++ descendants ++ [tab]
  end

  def subtree_nodes(_community, _branch, %DocTreeNode{} = node), do: [node]

  defp trash_attrs(%Community{} = community, branch, %DocTreeNode{} = node, actor_id) do
    %{
      community_id: community.id,
      branch_id: branch.id,
      node_id: node.node_id,
      doc_id: node.doc_id,
      node_snapshot:
        node
        |> Read.to_map()
        |> Map.put("tabId", node.tab_id)
        |> Map.put("groupId", node.group_id)
        |> maybe_put_draft_doc_snapshot(community, branch, node),
      deleted_from_group_id: node.group_id,
      deleted_from_index: node.index,
      deleted_at: DateTime.utc_now(:second),
      deleted_by_id: actor_id
    }
  end

  defp maybe_put_draft_doc_snapshot(snapshot, %Community{} = community, branch, %DocTreeNode{
         type: :page,
         doc_id: doc_id
       })
       when not is_nil(doc_id) do
    case TrashSnapshot.draft_doc_snapshot(community, branch, doc_id) do
      nil -> snapshot
      draft_snapshot -> Map.put(snapshot, @trash_snapshot_key_draft_doc, draft_snapshot)
    end
  end

  defp maybe_put_draft_doc_snapshot(snapshot, _community, _branch, _node), do: snapshot

  defp subtree_doc_ids(nodes) do
    nodes
    |> Enum.filter(&(&1.type == :page))
    |> Enum.map(& &1.doc_id)
    |> Enum.reject(&is_nil/1)
    |> Enum.uniq()
  end

  defp unreferenced_doc_ids([], _community, _branch, _subtree_node_ids), do: []

  defp unreferenced_doc_ids(doc_ids, %Community{} = community, branch, subtree_node_ids) do
    referenced_doc_ids =
      DocTreeNode
      |> where([n], n.community_id == ^community.id)
      |> where([n], n.branch_id == ^branch.id)
      |> where([n], n.stage == CMS.Const.stage(:draft))
      |> where([n], n.type == :page)
      |> where([n], n.doc_id in ^doc_ids)
      |> where([n], n.node_id not in ^subtree_node_ids)
      |> select([n], n.doc_id)
      |> Repo.all()
      |> MapSet.new()

    Enum.reject(doc_ids, &MapSet.member?(referenced_doc_ids, &1))
  end
end
