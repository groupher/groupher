defmodule GroupherServer.CMS.DocTree.Writer.Index do
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
  alias GroupherServer.CMS.Model.{Community, DocTreeNode}

  require CMS.Const

  @temporary_index_offset 100_000

  @doc """
  Moves one draft tree node to a new sibling position.

  The old position is vacated before reindexing the target scope, and the
  previous sibling scope is normalized when the node changes parents.

  ## Examples

      Index.move_node(community, branch, node, new_parent_node_id, 0)
      #=> :ok

  """
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

    batch_reindex_nodes!(
      ordered_nodes,
      community,
      branch,
      parent_node_id,
      touch_updated_at?: false
    )

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
    |> batch_reindex_nodes!(community, branch, parent_node_id,
      touch_updated_at?: true,
      updated_at: now
    )

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

  # The temporary offset above keeps the immediate sibling uniqueness indexes
  # clear while this statement writes every final position at once. Keeping the
  # tenant, branch, stage, and parent predicates in SQL also makes a stale input
  # fail atomically instead of silently moving a row from another scope.
  defp batch_reindex_nodes!(nodes, community, branch, parent_node_id, opts) do
    {ids, indexes} =
      nodes
      |> Enum.with_index()
      |> Enum.map(fn {%DocTreeNode{id: id}, index} -> {id, index} end)
      |> Enum.unzip()

    {timestamp_assignment, params} =
      if Keyword.fetch!(opts, :touch_updated_at?) do
        {", updated_at = $7",
         [
           ids,
           indexes,
           community.id,
           branch.id,
           Atom.to_string(CMS.Const.stage(:draft)),
           parent_node_id,
           Keyword.fetch!(opts, :updated_at)
         ]}
      else
        {"",
         [
           ids,
           indexes,
           community.id,
           branch.id,
           Atom.to_string(CMS.Const.stage(:draft)),
           parent_node_id
         ]}
      end

    result =
      Repo.query!(
        """
        UPDATE cms.doc_tree_nodes AS node
        SET parent_node_id = $6::varchar,
            "index" = updates.new_index#{timestamp_assignment}
        FROM UNNEST($1::bigint[], $2::integer[]) AS updates(id, new_index)
        WHERE node.id = updates.id
          AND node.community_id = $3
          AND node.branch_id = $4
          AND node.stage = $5
          AND node.parent_node_id IS NOT DISTINCT FROM $6::varchar
        """,
        params
      )

    if result.num_rows != length(ids) do
      raise "doc tree reindex updated #{result.num_rows} of #{length(ids)} expected nodes"
    end

    :ok
  end

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
end
