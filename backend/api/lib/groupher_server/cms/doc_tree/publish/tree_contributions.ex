defmodule GroupherServer.CMS.DocTree.Publish.TreeContributions do
  @moduledoc """
  Tracks the authors of a directory node's current net change by field.

      public node + previous target + new target + field authors -> new field authors

  Callers validate complete trees and persist the result under the site lock.
  The existence author keeps the creator or deleter in the approval set.
  """

  @fields ~w(parent_node_id index title href doc_id marker badge hidden)a
  @allowed [:existence | @fields]

  @doc "Recomputes field authors for one already validated node transition."
  def reconcile(public, previous, target, authors, actor_id)
      when (is_nil(public) or is_map(public)) and (is_nil(previous) or is_map(previous)) and
             (is_nil(target) or is_map(target)) and is_map(authors) and is_integer(actor_id) and
             actor_id > 0 do
    with true <- valid_node?(public) and valid_node?(previous) and valid_node?(target),
         true <- same_identity?([public, previous, target]),
         expected = active_fields(public, previous),
         true <- MapSet.new(Map.keys(authors)) == MapSet.new(expected),
         true <-
           Enum.all?(authors, fn {field, id} ->
             field in @allowed and is_integer(id) and id > 0
           end) do
      {:ok, compute(public, previous, target, authors, actor_id)}
    else
      false -> {:error, :invalid_tree_contributions}
    end
  end

  def reconcile(_, _, _, _, _), do: {:error, :invalid_tree_contributions}

  defp valid_node?(nil), do: true

  defp valid_node?(node) do
    Enum.all?([:node_id, :type | @fields], &Map.has_key?(node, &1))
  end

  defp same_identity?(nodes) do
    identities =
      nodes |> Enum.reject(&is_nil/1) |> Enum.map(&{&1.node_id, &1.type}) |> Enum.uniq()

    length(identities) <= 1
  end

  defp active_fields(nil, nil), do: []
  defp active_fields(nil, _target), do: @allowed
  defp active_fields(_public, nil), do: [:existence]
  defp active_fields(public, target), do: Enum.filter(@fields, &(public[&1] != target[&1]))

  defp compute(public, previous, target, authors, actor_id) do
    Map.new(active_fields(public, target), fn field ->
      retained? =
        Map.has_key?(authors, field) and
          (field == :existence or (not is_nil(previous) and previous[field] == target[field]))

      {field, if(retained?, do: authors[field], else: actor_id)}
    end)
  end
end
