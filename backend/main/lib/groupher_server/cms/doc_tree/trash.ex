defmodule GroupherServer.CMS.DocTree.Trash do
  @moduledoc """
  Product trash workflow for docs tree items.

  Staged-delete restore remains part of the publish checklist. This module is
  for the product Trash drawer: it lists persisted trash snapshots and restores
  them back into the draft tree as new staged create events.

      Trash drawer
          |
          +--> list visible doc_tree_trash_items
          |       |
          |       v
          |   hide children whose parent group is also trashed
          |
          +--> restore one root item
                  |
                  v
              rebuild draft nodes from snapshots
                  |
                  v
              rebuild missing draft doc via TrashSnapshot
                  |
                  v
              record staged create events + restore audit
  """

  import Ecto.Query, warn: false

  alias GroupherServer.{CMS, Repo}
  alias CMS.DocTree.{Branch, Events, Read, TrashSnapshot}
  alias CMS.DocTree.Write.{Index, Operation}

  alias CMS.Model.{
    Community,
    Doc,
    DocTreeNode,
    DocTreeRestoreAudit,
    DocTreeTrashItem
  }

  alias Helper.{ORM, T}

  require CMS.Const

  @tree_node_type_group CMS.Const.tree_node_type(:group)
  @tree_node_type_pin CMS.Const.tree_node_type(:pin)

  @doc """
  Lists visible, unrestored product Trash items for the resolved docs branch.

  Children of a trashed group are stored for restore, but hidden from the list
  so users restore the group as the root action.
  """
  @spec list(Community.t(), keyword() | map()) :: T.domain_res(list(map()))
  def list(%Community{} = community, opts \\ []) do
    with {:ok, branch} <- Branch.resolve(community, opts) do
      items =
        DocTreeTrashItem
        |> where([item], item.community_id == ^community.id)
        |> where([item], item.branch_id == ^branch.id)
        |> where([item], is_nil(item.restored_at))
        |> order_by([item], desc: item.deleted_at, desc: item.id)
        |> Repo.all()

      {:ok, Enum.map(visible_items(items), &to_map/1)}
    end
  end

  @doc """
  Restores one product Trash item into the draft tree and records staged creates.
  """
  @spec restore(Community.t(), T.id(), map()) :: T.domain_res(map())
  def restore(%Community{} = community, item_id, args) do
    Operation.run(community, args, fn branch, state ->
      with {:ok, root_item} <- find_item(community, branch, item_id),
           {:ok, items} <- restore_items(community, branch, root_item),
           {:ok, nodes} <- restore_nodes(community, branch, items),
           {:ok, events} <-
             Events.record_staged_many(
               community,
               Enum.map(nodes, &Events.create_event/1),
               Map.get(args, :actor_id),
               branch_id: branch.id
             ),
           :ok <- mark_items_restored(items),
           {:ok, _audit} <-
             create_restore_audit(community, branch, args, root_item, events, nodes),
           {:ok, state} <- Operation.bump_revision(community, state, length(events)) do
        affected =
          nodes
          |> Enum.map(&{&1.group_id, &1.type})
          |> Enum.uniq()
          |> Enum.flat_map(fn {group_id, type} ->
            Index.affected_nodes(community, branch, group_id, type)
          end)

        {:ok, Operation.payload(community, state, List.first(nodes), affected)}
      end
    end)
  end

  defp visible_items(items) do
    trashed_group_ids =
      items
      |> Enum.filter(&(snapshot_type(&1) == to_string(@tree_node_type_group)))
      |> MapSet.new(& &1.node_id)

    Enum.reject(items, fn item ->
      item.deleted_from_group_id && MapSet.member?(trashed_group_ids, item.deleted_from_group_id)
    end)
  end

  defp to_map(%DocTreeTrashItem{} = item) do
    snapshot = item.node_snapshot || %{}

    %{
      id: item.id,
      node_id: item.node_id,
      doc_id: item.doc_id,
      type: snapshot_type(item),
      title: snapshot["title"] || item.node_id,
      slug: snapshot["slug"],
      deleted_from_group_id: item.deleted_from_group_id,
      deleted_from_index: item.deleted_from_index,
      deleted_at: item.deleted_at,
      restored_at: item.restored_at
    }
  end

  defp snapshot_type(%DocTreeTrashItem{node_snapshot: %{"type" => type}}), do: type
  defp snapshot_type(_item), do: nil

  defp find_item(%Community{} = community, branch, item_id) do
    DocTreeTrashItem
    |> where([item], item.community_id == ^community.id)
    |> where([item], item.branch_id == ^branch.id)
    |> where([item], item.id == ^item_id)
    |> where([item], is_nil(item.restored_at))
    |> Repo.one()
    |> case do
      %DocTreeTrashItem{} = item -> {:ok, item}
      nil -> {:error, {:custom, "Trash item not found."}}
    end
  end

  defp restore_items(%Community{} = community, branch, %DocTreeTrashItem{} = root_item) do
    items =
      if snapshot_type(root_item) == to_string(@tree_node_type_group) do
        child_items(community, branch, root_item.node_id)
      else
        []
      end

    {:ok, [root_item | items]}
  end

  defp child_items(%Community{} = community, branch, group_node_id) do
    DocTreeTrashItem
    |> where([item], item.community_id == ^community.id)
    |> where([item], item.branch_id == ^branch.id)
    |> where([item], item.deleted_from_group_id == ^group_node_id)
    |> where([item], is_nil(item.restored_at))
    |> order_by([item], asc: item.deleted_from_index, asc: item.id)
    |> Repo.all()
  end

  defp restore_nodes(%Community{} = community, branch, items) do
    Enum.reduce_while(items, {:ok, []}, fn item, {:ok, acc} ->
      case restore_node(community, branch, item) do
        {:ok, node} -> {:cont, {:ok, [node | acc]}}
        error -> {:halt, error}
      end
    end)
    |> case do
      {:ok, nodes} -> {:ok, Enum.reverse(nodes)}
      error -> error
    end
  end

  defp restore_node(%Community{} = community, branch, %DocTreeTrashItem{} = item) do
    with nil <- draft_node_by_node_id(community, branch, item.node_id),
         {:ok, attrs} <- draft_attrs_from_trash_item(community, branch, item),
         :ok <-
           Index.shift_sibling_indexes(
             community,
             branch,
             attrs.group_id,
             attrs.type,
             attrs.index,
             nil
           ),
         {:ok, node} <- ORM.create(DocTreeNode, attrs),
         :ok <- restore_doc_draft_from_trash(community, branch, item) do
      {:ok, node}
    else
      %DocTreeNode{} -> {:error, {:custom, "Trash item has already been restored."}}
      error -> error
    end
  end

  defp draft_node_by_node_id(%Community{} = community, branch, node_id) do
    DocTreeNode
    |> where([node], node.community_id == ^community.id)
    |> where([node], node.branch_id == ^branch.id)
    |> where([node], node.stage == CMS.Const.stage(:draft))
    |> where([node], node.node_id == ^to_string(node_id))
    |> Repo.one()
  end

  defp draft_attrs_from_trash_item(%Community{} = community, branch, %DocTreeTrashItem{} = item) do
    snapshot = item.node_snapshot || %{}

    with {:ok, type} <- node_type_atom(snapshot["type"]),
         :ok <- validate_parent(community, branch, item, type) do
      {:ok,
       %{
         community_id: community.id,
         branch_id: branch.id,
         node_id: snapshot["id"] || item.node_id,
         stage: CMS.Const.stage(:draft),
         type: type,
         group_id: item.deleted_from_group_id || snapshot["groupId"],
         doc_id: item.doc_id || snapshot["docId"],
         title: snapshot["title"],
         slug: snapshot["slug"],
         index: item.deleted_from_index || snapshot["index"] || 0,
         href: snapshot["href"],
         marker: snapshot["marker"],
         badge: snapshot["badge"],
         hidden: Map.get(snapshot, "hidden", false),
         ui_config: Map.get(snapshot, "uiConfig", %{})
       }}
    end
  end

  defp validate_parent(_community, _branch, _item, type)
       when type in [@tree_node_type_group, @tree_node_type_pin],
       do: :ok

  defp validate_parent(%Community{} = community, branch, %DocTreeTrashItem{} = item, _type) do
    parent_id = item.deleted_from_group_id || item.node_snapshot["groupId"]

    case draft_node_by_node_id(community, branch, parent_id) do
      %DocTreeNode{type: @tree_node_type_group} -> :ok
      _ -> {:error, {:custom, "Restore the parent group before restoring this item."}}
    end
  end

  defp restore_doc_draft_from_trash(
         %Community{} = community,
         branch,
         %DocTreeTrashItem{doc_id: doc_id, node_snapshot: snapshot}
       )
       when not is_nil(doc_id) do
    case draft_doc_by_doc_id(community, branch, doc_id) do
      %Doc{} ->
        :ok

      nil ->
        case TrashSnapshot.fetch_draft_doc_snapshot(snapshot) do
          {:ok, draft_snapshot} ->
            TrashSnapshot.restore_doc_draft(community, branch, draft_snapshot)

          {:error, :not_found} ->
            :ok
        end
    end
  end

  defp restore_doc_draft_from_trash(_community, _branch, _item), do: :ok

  defp draft_doc_by_doc_id(%Community{} = community, branch, doc_id) do
    Doc
    |> where([doc], doc.community_id == ^community.id)
    |> where([doc], doc.branch_id == ^branch.id)
    |> where([doc], doc.stage == CMS.Const.stage(:draft))
    |> where([doc], doc.doc_id == ^doc_id)
    |> Repo.one()
  end

  defp mark_items_restored(items) do
    ids = Enum.map(items, & &1.id)
    now = DateTime.utc_now(:second)

    DocTreeTrashItem
    |> where([item], item.id in ^ids)
    |> Repo.update_all(set: [restored_at: now, updated_at: now])

    :ok
  end

  defp create_restore_audit(
         %Community{} = community,
         branch,
         args,
         %DocTreeTrashItem{} = root_item,
         events,
         nodes
       ) do
    ORM.create(DocTreeRestoreAudit, %{
      community_id: community.id,
      branch_id: branch.id,
      actor_id: Map.get(args, :actor_id),
      restored_event_ids: Enum.map(events, & &1.id),
      restored_node_ids: Enum.map(nodes, & &1.node_id),
      restored_at: DateTime.utc_now(:second),
      payload: %{
        "trashItemId" => root_item.id,
        "items" => Enum.map(nodes, &Read.to_map/1)
      }
    })
  end

  defp node_type_atom(type) when is_binary(type) do
    Enum.find(CMS.Const.tree_node_type_values(), &(to_string(&1) == type))
    |> case do
      nil -> {:error, {:custom, "Unsupported docs tree node type: #{type}"}}
      atom -> {:ok, atom}
    end
  end

  defp node_type_atom(_type), do: {:error, {:custom, "Trash item has invalid node type."}}
end
