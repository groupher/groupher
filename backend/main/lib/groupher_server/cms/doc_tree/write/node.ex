defmodule GroupherServer.CMS.DocTree.Write.Node do
  @moduledoc """
  Finds draft tree nodes and validates structural parent rules.

      node_id
          |
          v
      doc_tree_nodes(stage=draft)
          |
          +--> group parent lookup
          +--> move target validation
          +--> new node_id generation for creates/copies

  Parent policy lives here so every write path agrees on the same tree shape:
  groups and pins are root nodes, while page/link nodes must live inside a
  normal group and cannot be moved into the top pin area.
  """

  import Ecto.Query, warn: false

  alias GroupherServer.{CMS, Repo}
  alias CMS.Model.{Community, DocTreeNode}

  require CMS.Const

  def put_new_node_id(attrs), do: Map.put_new(attrs, :node_id, new_node_id())
  def new_node_id, do: Ecto.UUID.generate()

  def find(%Community{} = community, branch, node_id) do
    DocTreeNode
    |> where([n], n.community_id == ^community.id)
    |> where([n], n.branch_id == ^branch.id)
    |> where([n], n.stage == CMS.Const.stage(:draft))
    |> where([n], n.node_id == ^to_string(node_id))
    |> Repo.one()
    |> case do
      %DocTreeNode{} = node -> {:ok, node}
      _ -> {:error, {:custom, "doc tree node not found"}}
    end
  end

  def group_parent(%Community{} = community, branch, group_id) do
    with {:ok, parent} <- find(community, branch, group_id),
         true <- parent.type == :group do
      {:ok, parent}
    else
      false -> {:error, {:custom, "doc tree parent must be a group"}}
      error -> error
    end
  end

  def tab_parent(%Community{} = community, branch, tab_id) do
    with {:ok, parent} <- find(community, branch, tab_id),
         true <- parent.type == :tab do
      {:ok, parent}
    else
      false -> {:error, {:custom, "doc tree parent must be a tab"}}
      error -> error
    end
  end

  def first_tab(%Community{} = community, branch) do
    DocTreeNode
    |> where([n], n.community_id == ^community.id)
    |> where([n], n.branch_id == ^branch.id)
    |> where([n], n.stage == CMS.Const.stage(:draft))
    |> where([n], n.type == :tab)
    |> order_by([n], asc: n.index, asc: n.id)
    |> limit(1)
    |> Repo.one()
  end

  def validate_target(_community, _branch, %{type: :tab}, nil, nil), do: {:ok, {nil, nil}}

  def validate_target(community, branch, %{type: type}, tab_id, nil)
      when type in [:group, :pin] do
    with {:ok, tab} <- tab_parent(community, branch, tab_id), do: {:ok, {tab.node_id, nil}}
  end

  def validate_target(community, branch, %{type: type}, nil, group_id)
      when type in [:page, :link] do
    with {:ok, group} <- group_parent(community, branch, group_id),
         do: {:ok, {nil, group.node_id}}
  end

  def validate_target(_community, _branch, _node, _tab_id, _group_id),
    do: {:error, {:custom, "invalid docs tree target"}}

  def validate_target_group(_community, _branch, %{type: :group}, nil), do: {:ok, nil}

  def validate_target_group(_community, _branch, %{type: :group}, _),
    do: {:error, {:custom, "group nodes must be root nodes"}}

  def validate_target_group(_community, _branch, %{type: :pin}, nil), do: {:ok, nil}

  def validate_target_group(_community, _branch, %{type: :pin}, _),
    do: {:error, {:custom, "pin nodes can only move inside top pins"}}

  def validate_target_group(_community, _branch, %{type: type}, "pin")
      when type in [:page, :link],
      do: {:error, {:custom, "docs can not be dragged into top pins"}}

  def validate_target_group(community, branch, _node, group_id) do
    with {:ok, parent} <- group_parent(community, branch, group_id), do: {:ok, parent.node_id}
  end
end
