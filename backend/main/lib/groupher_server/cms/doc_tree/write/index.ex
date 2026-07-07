defmodule GroupherServer.CMS.DocTree.Write.Index do
  @moduledoc """
  Maintains sibling ordering for draft tree nodes.

      create
          |
          v
      ensure_index -> next max(index) + 1

      duplicate / move / delete
          |
          +--> shift_sibling_indexes before insert/move
          +--> normalize_sibling_indexes after removal/move
          |
          v
      affected_nodes ordered for client refresh

  Index repair is scoped to one sibling list at a time: top groups, top pins,
  or the children of a group.
  """

  import Ecto.Query, warn: false

  alias GroupherServer.{CMS, Repo}
  alias CMS.Model.{Community, DocTreeNode}

  require CMS.Const

  def ensure_index(%{index: index} = attrs, %Community{}, _branch, _group_id)
      when not is_nil(index),
      do: attrs

  def ensure_index(attrs, %Community{} = community, branch, group_id),
    do: Map.put(attrs, :index, next_index(community, branch, group_id, Map.get(attrs, :type)))

  def shift_sibling_indexes(community, branch, group_id, from_index, exclude_node_id) do
    query =
      DocTreeNode
      |> where([n], n.community_id == ^community.id)
      |> where([n], n.branch_id == ^branch.id)
      |> where([n], n.stage == CMS.Const.stage(:draft))
      |> where_sibling_scope(group_id, nil)
      |> where([n], n.index >= ^from_index)

    query =
      if is_nil(exclude_node_id),
        do: query,
        else: where(query, [n], n.node_id != ^exclude_node_id)

    Repo.update_all(query, inc: [index: 1])
    :ok
  end

  def normalize_sibling_indexes(%Community{} = community, branch, group_id) do
    now = DateTime.utc_now(:second)

    ranked =
      DocTreeNode
      |> where([n], n.community_id == ^community.id)
      |> where([n], n.branch_id == ^branch.id)
      |> where([n], n.stage == CMS.Const.stage(:draft))
      |> where_sibling_scope(group_id, nil)
      |> select([n], %{
        id: n.id,
        normalized_index: fragment("row_number() over (order by ?, ?) - 1", n.index, n.id)
      })

    DocTreeNode
    |> join(:inner, [n], r in subquery(ranked), on: n.id == r.id)
    |> update([_n, r], set: [index: r.normalized_index, updated_at: ^now])
    |> Repo.update_all([])

    :ok
  end

  def affected_nodes(%Community{} = community, branch, group_id) do
    DocTreeNode
    |> where([n], n.community_id == ^community.id)
    |> where([n], n.branch_id == ^branch.id)
    |> where([n], n.stage == CMS.Const.stage(:draft))
    |> where_sibling_scope(group_id, nil)
    |> order_by([n], asc: n.index, asc: n.id)
    |> Repo.all()
  end

  defp next_index(%Community{} = community, branch, group_id, type) do
    DocTreeNode
    |> where([n], n.community_id == ^community.id)
    |> where([n], n.branch_id == ^branch.id)
    |> where([n], n.stage == CMS.Const.stage(:draft))
    |> where_sibling_scope(group_id, type)
    |> select([n], max(n.index))
    |> Repo.one()
    |> case do
      nil -> 0
      index -> index + 1
    end
  end

  defp where_group(query, nil), do: where(query, [n], is_nil(n.group_id))
  defp where_group(query, group_id), do: where(query, [n], n.group_id == ^group_id)

  defp where_sibling_scope(query, nil, nil), do: where_group(query, nil)

  defp where_sibling_scope(query, nil, type) do
    query |> where_group(nil) |> where([n], n.type == ^type)
  end

  defp where_sibling_scope(query, group_id, _type), do: where_group(query, group_id)
end
