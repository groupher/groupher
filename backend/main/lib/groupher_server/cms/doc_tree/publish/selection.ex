defmodule GroupherServer.CMS.DocTree.Publish.Selection do
  require GroupherServer.CMS.DocTree.Const
  @moduledoc """
  Normalizes publish input into one explicit selection.

      GraphQL input
          |
          v
      doc_change_ids / tree_change_ids / restore_tree_change_ids
          |
          +--> omitted tree list -> publish all selectable tree items
          +--> omitted doc list  -> publish all selectable doc items
          +--> explicit list     -> validate checklist ids
          |
          v
      %{doc_checklist_item_ids, tree_checklist_item_ids, restore_tree_checklist_item_ids}
          |
          v
      publish flow: noop | publish | restore

  This module does not query or mutate the database. It only reads the current
  `Checklist` output, validates opaque checklist ids, and tells the orchestrator
  which unified publish path should run.
  """

  alias GroupherServer.CMS
  alias GroupherServer.CMS.DocTree.Publish.Result


  @publish_input_key_doc_changes CMS.DocTree.Const.doc_publish_input_key(:doc_change_ids)
  @publish_input_key_tree_changes CMS.DocTree.Const.doc_publish_input_key(:tree_change_ids)
  @publish_input_key_restore_tree_changes CMS.DocTree.Const.doc_publish_input_key(
                                            :restore_tree_change_ids
                                          )
  @publish_flow_noop CMS.DocTree.Const.doc_publish_flow(:noop)
  @publish_flow_publish CMS.DocTree.Const.doc_publish_flow(:publish)
  @publish_flow_restore CMS.DocTree.Const.doc_publish_flow(:restore)

  @doc """
  Normalizes publish input into one explicit checklist selection.

  Omitted lists default to all selectable items. Explicit ids must be known and
  selectable, and a tree item can not be both published and restored.

  ## Examples

      Selection.from_input(args, checklist)
      #=> {:ok,
      #=>  %{doc_checklist_item_ids: [...], tree_checklist_item_ids: [...],
      #=>    restore_tree_checklist_item_ids: []}}

  """
  def from_input(args, current_checklist) do
    with {:ok, doc_checklist_item_ids} <-
           selected_checklist_item_ids(
             args,
             @publish_input_key_doc_changes,
             current_checklist.doc_changes
           ),
         {:ok, tree_checklist_item_ids} <-
           selected_tree_checklist_item_ids(args, current_checklist.tree_changes),
         {:ok, restore_tree_checklist_item_ids} <-
           selected_restore_tree_checklist_item_ids(args, current_checklist.tree_changes),
         :ok <-
           reject_overlapping_tree_selections(
             tree_checklist_item_ids,
             restore_tree_checklist_item_ids
           ) do
      {:ok,
       %{
         doc_checklist_item_ids: doc_checklist_item_ids,
         tree_checklist_item_ids: tree_checklist_item_ids,
         restore_tree_checklist_item_ids: restore_tree_checklist_item_ids
       }}
    end
  end

  def put_tree_checklist_item_ids(selection, tree_checklist_item_ids),
    do: %{selection | tree_checklist_item_ids: tree_checklist_item_ids}

  def flow(
        current_checklist,
        %{
          doc_checklist_item_ids: doc_checklist_item_ids,
          tree_checklist_item_ids: tree_checklist_item_ids,
          restore_tree_checklist_item_ids: restore_tree_checklist_item_ids
        }
      ) do
    publish_flow(
      current_checklist,
      doc_checklist_item_ids,
      tree_checklist_item_ids,
      restore_tree_checklist_item_ids
    )
  end

  def tree_selection_omitted?(args) do
    Enum.all?(
      [@publish_input_key_tree_changes, @publish_input_key_restore_tree_changes],
      fn key -> not (Map.has_key?(args, key) or Map.has_key?(args, Atom.to_string(key))) end
    )
  end

  defp selected_checklist_item_ids(args, key, items) do
    args
    |> selected_value(key)
    |> checklist_item_ids_from(items)
  end

  defp selected_tree_checklist_item_ids(args, items) do
    tree_value = selected_value(args, @publish_input_key_tree_changes)
    restore_value = selected_value(args, @publish_input_key_restore_tree_changes)

    case {tree_value, restore_value} do
      {nil, restore_ids} when is_list(restore_ids) -> {:ok, []}
      _ -> checklist_item_ids_from(tree_value, items)
    end
  end

  defp selected_value(args, key), do: Map.get(args, key) || Map.get(args, Atom.to_string(key))

  defp selected_restore_tree_checklist_item_ids(args, items) do
    case selected_value(args, @publish_input_key_restore_tree_changes) do
      nil -> {:ok, []}
      checklist_item_ids -> checklist_item_ids_from(checklist_item_ids, items)
    end
  end

  defp checklist_item_ids_from(nil, items),
    do: {:ok, items |> Enum.filter(& &1.selectable) |> Enum.map(& &1.id)}

  defp checklist_item_ids_from(checklist_item_ids, items) when is_list(checklist_item_ids) do
    by_id = Map.new(items, &{&1.id, &1})

    # Explicit checklist selections must fail loudly when the client submits a
    # stale or disabled id; silent filtering would publish a different set.
    checklist_item_ids
    |> Enum.map(&to_string/1)
    |> Result.map_while_ok(&selected_checklist_item_id(&1, by_id))
  end

  defp checklist_item_ids_from(_checklist_item_ids, _items),
    do: {:error, GroupherServer.ErrorCat.custom("Selected publish item ids must be a list.")}

  defp selected_checklist_item_id(id, by_id),
    do: selectable_checklist_item_id(id, Map.get(by_id, id))

  defp selectable_checklist_item_id(_id, nil),
    do: {:error, GroupherServer.ErrorCat.custom("Selected publish item no longer exists.")}

  defp selectable_checklist_item_id(_id, %{selectable: false, disabled_reason: reason}),
    do:
      {:error,
       GroupherServer.ErrorCat.custom(reason || "Selected publish item is not available.")}

  defp selectable_checklist_item_id(id, _item), do: {:ok, id}

  defp reject_overlapping_tree_selections(
         tree_checklist_item_ids,
         restore_tree_checklist_item_ids
       ) do
    tree_checklist_item_id_set = MapSet.new(Enum.map(tree_checklist_item_ids, &to_string/1))

    restore_tree_checklist_item_id_set =
      MapSet.new(Enum.map(restore_tree_checklist_item_ids, &to_string/1))

    if MapSet.disjoint?(tree_checklist_item_id_set, restore_tree_checklist_item_id_set) do
      :ok
    else
      {:error,
       GroupherServer.ErrorCat.custom(
         "Tree publish items can not be both published and restored."
       )}
    end
  end

  defp publish_flow(%{total_count: 0}, [], [], []), do: {:ok, @publish_flow_noop}

  defp publish_flow(_checklist, [], [], []),
    do: {:error, GroupherServer.ErrorCat.custom("No publish changes selected.")}

  defp publish_flow(_checklist, [], [], _restore_tree_checklist_item_ids),
    do: {:ok, @publish_flow_restore}

  defp publish_flow(
         _checklist,
         _doc_checklist_item_ids,
         _tree_checklist_item_ids,
         _restore_tree_checklist_item_ids
       ),
       do: {:ok, @publish_flow_publish}
end
