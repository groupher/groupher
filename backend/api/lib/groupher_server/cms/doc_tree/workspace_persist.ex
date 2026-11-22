defmodule GroupherServer.CMS.DocTree.WorkspacePersist do
  @moduledoc """
  Persists validated workspace node changes under the caller's site lock.

      Docs workspace command -> WorkspacePersist -> tree nodes and ordering
  """

  import Ecto.Query
  alias GroupherServer.{CMS, Repo}
  alias CMS.Model.{Community, DocsTreeNode}

  @doc "Locks the workspace rows in stable logical ID order."
  def lock_nodes(%Community{} = community) do
    Repo.all(
      from(n in DocsTreeNode,
        where: n.community_id == ^community.id and n.stage == :draft,
        order_by: n.node_id,
        lock: "FOR UPDATE"
      )
    )
  end

  @doc "Stages changed positions, then writes validated nodes in the same transaction."
  def save(%Community{} = community, rows, changed) when is_list(rows) and is_list(changed) do
    existing = Map.new(rows, &{&1.node_id, &1})
    staged = Enum.filter(changed, &Map.has_key?(existing, &1.node_id))

    if length(staged) > 2_147_483_647 or Enum.any?(rows, &(&1.index < 0)) do
      {:error, :invalid_docs_tree_staging}
    else
      with {:ok, :pass} <- stage(staged, existing),
           {:ok, :pass} <- write(changed, existing, community) do
        {:ok, :pass}
      end
    end
  end

  defp stage(nodes, existing) do
    nodes
    |> Enum.with_index(1)
    |> Enum.reduce_while({:ok, :pass}, fn {node, index}, _ ->
      row = existing[node.node_id]

      case Repo.update_all(from(n in DocsTreeNode, where: n.id == ^row.id), set: [index: -index]) do
        {1, nil} -> {:cont, {:ok, :pass}}
        _ -> {:halt, {:error, :docs_tree_changed}}
      end
    end)
  end

  defp write(nodes, existing, community) do
    Enum.reduce_while(nodes, {:ok, :pass}, fn node, _ ->
      row = Map.get(existing, node.node_id) || %DocsTreeNode{}
      attrs = Map.merge(node, %{community_id: community.id, stage: :draft})

      changeset =
        row |> DocsTreeNode.changeset(attrs) |> Ecto.Changeset.force_change(:index, node.index)

      case Repo.insert_or_update(changeset) do
        {:ok, _} -> {:cont, {:ok, :pass}}
        {:error, _reason} = error -> {:halt, error}
      end
    end)
  end
end
