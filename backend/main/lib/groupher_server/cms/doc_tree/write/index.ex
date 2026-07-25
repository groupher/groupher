defmodule GroupherServer.CMS.DocTree.Write.Index do
  @moduledoc """
  Maintains sibling ordering for draft tree nodes.

      create
          |
          v
      ensure_index -> canonical Group/leaf lane position

      duplicate / move / delete
          |
          +--> shift_sibling_indexes before insert/move
          +--> normalize_sibling_indexes after removal/move
          |
          v
      affected_nodes ordered for client refresh

  Index repair is scoped to one sibling scope at a time: root Tabs, a Tab's Pins,
  or the Group-first mixed pages of any Tab/Group.
  """

  import Ecto.Query, warn: false

  alias GroupherServer.{CMS, Repo}
  alias CMS.Model.{Community, DocTreeNode}

  require CMS.Const

  @temporary_index_offset 100_000

  def move_node(%Community{} = community, branch, %DocTreeNode{} = node, parent_node_id, index) do
    old_parent_node_id = node.parent_node_id

    # Vacate the node's old unique position before switching sibling scopes.
    DocTreeNode
    |> where([n], n.id == ^node.id)
    |> Repo.update_all(
      set: [parent_node_id: parent_node_id, index: -@temporary_index_offset - node.id]
    )

    target_nodes =
      community
      |> sibling_nodes(branch, parent_node_id, node.type)
      |> Enum.reject(&(&1.id == node.id))

    index = canonical_index(target_nodes, node.type, index)
    ordered_nodes = List.insert_at(target_nodes, index, node)

    target_scope =
      DocTreeNode
      |> where([n], n.community_id == ^community.id)
      |> where([n], n.branch_id == ^branch.id)
      |> where([n], n.stage == CMS.Const.stage(:draft))
      |> where_sibling_scope(parent_node_id, node.type)

    Repo.update_all(target_scope, inc: [index: @temporary_index_offset])

    ordered_nodes
    |> Enum.with_index()
    |> Enum.each(fn {%DocTreeNode{id: id}, next_index} ->
      DocTreeNode
      |> where([n], n.id == ^id)
      |> Repo.update_all(set: [parent_node_id: parent_node_id, index: next_index])
    end)

    if old_parent_node_id != parent_node_id,
      do: normalize_sibling_indexes(community, branch, old_parent_node_id, node.type)

    :ok
  end

  def ensure_index(attrs, %Community{} = community, branch, parent_node_id) do
    type = Map.get(attrs, :type)
    normalize_sibling_indexes(community, branch, parent_node_id, type)
    siblings = sibling_nodes(community, branch, parent_node_id, type)
    index = canonical_index(siblings, type, Map.get(attrs, :index))

    if index < length(siblings) do
      shift_sibling_indexes(community, branch, parent_node_id, type, index, nil)
    end

    Map.put(attrs, :index, index)
  end

  def shift_sibling_indexes(
        community,
        branch,
        parent_node_id,
        type,
        from_index,
        exclude_node_id
      ) do
    query =
      DocTreeNode
      |> where([n], n.community_id == ^community.id)
      |> where([n], n.branch_id == ^branch.id)
      |> where([n], n.stage == CMS.Const.stage(:draft))
      |> where_sibling_scope(parent_node_id, type)
      |> where([n], n.index >= ^from_index)

    query =
      if is_nil(exclude_node_id),
        do: query,
        else: where(query, [n], n.node_id != ^exclude_node_id)

    # Partial sibling indexes are immediate, so move the affected range out of
    # the final index space before assigning its +1 positions.
    Repo.update_all(query, inc: [index: @temporary_index_offset])

    query
    |> where([n], n.index >= ^(from_index + @temporary_index_offset))
    |> Repo.update_all(inc: [index: 1 - @temporary_index_offset])

    :ok
  end

  def normalize_sibling_indexes(%Community{} = community, branch, parent_node_id, type) do
    now = DateTime.utc_now(:second)

    scope =
      DocTreeNode
      |> where([n], n.community_id == ^community.id)
      |> where([n], n.branch_id == ^branch.id)
      |> where([n], n.stage == CMS.Const.stage(:draft))
      |> where_sibling_scope(parent_node_id, type)

    Repo.update_all(scope, inc: [index: @temporary_index_offset])

    community
    |> sibling_nodes(branch, parent_node_id, type)
    |> Enum.with_index()
    |> Enum.each(fn {%DocTreeNode{id: id}, normalized_index} ->
      DocTreeNode
      |> where([n], n.id == ^id)
      |> Repo.update_all(set: [index: normalized_index, updated_at: now])
    end)

    :ok
  end

  def affected_nodes(%Community{} = community, branch, parent_node_id, type) do
    sibling_nodes(community, branch, parent_node_id, type)
  end

  defp sibling_nodes(%Community{} = community, branch, parent_node_id, type) do
    DocTreeNode
    |> where([n], n.community_id == ^community.id)
    |> where([n], n.branch_id == ^branch.id)
    |> where([n], n.stage == CMS.Const.stage(:draft))
    |> where_sibling_scope(parent_node_id, type)
    |> order_by([n], asc: n.index, asc: n.id)
    |> Repo.all()
    |> Enum.sort_by(fn node -> {lane_rank(node.type), node.index, node.id} end)
  end

  defp canonical_index(nodes, :group, requested_index) do
    group_count = Enum.count(nodes, &(&1.type == :group))
    requested_index |> default_index(group_count) |> max(0) |> min(group_count)
  end

  defp canonical_index(nodes, type, requested_index) when type in [:page, :link] do
    group_count = Enum.count(nodes, &(&1.type == :group))

    requested_index
    |> default_index(length(nodes))
    |> max(group_count)
    |> min(length(nodes))
  end

  defp canonical_index(nodes, _type, requested_index),
    do: requested_index |> default_index(length(nodes)) |> max(0) |> min(length(nodes))

  defp default_index(nil, fallback), do: fallback
  defp default_index(index, _fallback), do: index

  defp lane_rank(:group), do: 0
  defp lane_rank(_type), do: 1

  defp where_sibling_scope(query, nil, :tab),
    do: query |> where([n], is_nil(n.parent_node_id)) |> where([n], n.type == :tab)

  defp where_sibling_scope(query, parent_node_id, :pin),
    do:
      query
      |> where([n], n.parent_node_id == ^parent_node_id)
      |> where([n], n.type == :pin)

  defp where_sibling_scope(query, parent_node_id, type)
       when type in [:group, :page, :link] or is_nil(type),
       do:
         query
         |> where([n], n.parent_node_id == ^parent_node_id)
         |> where([n], n.type in [:group, :page, :link])

  defp where_sibling_scope(query, nil, nil),
    do: where(query, [n], is_nil(n.parent_node_id))
end
