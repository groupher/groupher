defmodule GroupherServer.CMS.DocTree.Publish.Queue.Dependencies do
  @moduledoc """
  Adds the working-tree Page and missing parent shells for newly queued Docs.

    Existing public pages retain the Queue tree's position. A removed public
    ancestor is a blocker and is never silently restored.

      Queue tree command -> Dependencies -> required draft pages and parent nodes
  """

  alias GroupherServer.CMS
  alias CMS.DocTree.Publish.{TargetTree, TreeOrder}

  @doc "Builds a complete Queue target for the requested Doc identities."
  def target(public, draft, current, article_ids) when is_list(article_ids) do
    with {:ok, public} <- TargetTree.build(public, []),
         {:ok, draft} <- TargetTree.build(draft, []),
         {:ok, current} <- TargetTree.build(current, []) do
      public_by_id = Map.new(public, &{&1.node_id, &1})
      draft_by_id = Map.new(draft, &{&1.node_id, &1})
      draft_pages = draft |> Enum.filter(&(&1.type == :page)) |> Map.new(&{&1.doc_id, &1})
      public_pages = public |> Enum.filter(&(&1.type == :page)) |> Map.new(&{&1.doc_id, &1})

      Enum.reduce_while(Enum.sort(article_ids), {:ok, current}, fn id, {:ok, nodes} ->
        case add_page(id, nodes, draft_pages, public_pages, draft_by_id, public_by_id) do
          {:ok, result} -> {:cont, {:ok, result}}
          {:error, _reason} = error -> {:halt, error}
        end
      end)
    end
  end

  def target(_, _, _, _), do: {:error, :invalid_docs_dependencies}

  @doc "Adds a required draft parent chain without restoring deferred public nodes."
  def ensure_parent(public, draft, current, nil)
      when is_list(public) and is_list(draft) and is_list(current) do
    {:ok, current}
  end

  def ensure_parent(public, draft, current, id) when is_binary(id) do
    with {:ok, public} <- TargetTree.build(public, []),
         {:ok, draft} <- TargetTree.build(draft, []),
         {:ok, current} <- TargetTree.build(current, []) do
      add_node(id, current, Map.new(draft, &{&1.node_id, &1}), Map.new(public, &{&1.node_id, &1}))
    end
  end

  def ensure_parent(_, _, _, _), do: {:error, :invalid_docs_dependencies}

  defp add_page(id, nodes, draft_pages, public_pages, draft_by_id, public_by_id) do
    case {public_pages[id], draft_pages[id]} do
      {%{node_id: node_id}, _} ->
        if Enum.any?(nodes, &(&1.node_id == node_id and &1.doc_id == id)) do
          {:ok, nodes}
        else
          {:error, {:docs_dependency_deferred, node_id}}
        end

      {nil, %{node_id: node_id}} ->
        case Enum.find(nodes, &(&1.node_id == node_id)) do
          nil -> add_node(node_id, nodes, draft_by_id, public_by_id)
          %{type: :page, doc_id: ^id} -> {:ok, nodes}
          _ -> {:error, {:docs_dependency_conflict, node_id}}
        end

      {nil, nil} ->
        {:error, {:docs_page_missing, id}}
    end
  end

  defp add_node(id, nodes, draft_by_id, public_by_id) do
    cond do
      Enum.any?(nodes, &(&1.node_id == id)) ->
        {:ok, nodes}

      Map.has_key?(public_by_id, id) ->
        {:error, {:docs_dependency_deferred, id}}

      true ->
        case draft_by_id[id] do
          nil ->
            {:error, {:docs_dependency_missing, id}}

          node ->
            with {:ok, nodes} <- add_parent(node.parent_node_id, nodes, draft_by_id, public_by_id),
                 {:ok, %{target: target}} <- TreeOrder.insert(nodes, node, node.index) do
              {:ok, target}
            end
        end
    end
  end

  defp add_parent(nil, nodes, _draft, _public), do: {:ok, nodes}
  defp add_parent(id, nodes, draft, public), do: add_node(id, nodes, draft, public)
end
