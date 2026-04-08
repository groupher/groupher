defmodule GroupherServer.CMS.Model.Embeds.DashboardLayout do
  @type t :: %__MODULE__{}

  @moduledoc """
  general article comment meta info
  """
  use Ecto.Schema
  use Accessible

  import Ecto.Changeset

  import GroupherServerWeb.Schema.Helper.Fields,
    only: [dashboard_cast_fields: 1, dashboard_fields: 1]

  alias GroupherServer.CMS

  alias CMS.Helper.KanbanBoards
  alias CMS.Model.Metrics.Dashboard

  @optional_fields dashboard_cast_fields(:layout)

  @doc "for test usage"
  def default, do: Dashboard.layout_default()

  embedded_schema do
    dashboard_fields(:layout)
  end

  @doc "for test usage"

  def changeset(struct, params) do
    params = normalize_kanban_boards(params)

    struct
    |> cast(params, @optional_fields)
    |> validate_kanban_boards()
  end

  defp normalize_kanban_boards(params) when is_map(params) do
    case Map.get(params, :kanban_boards) do
      nil ->
        Map.put(params, :kanban_boards, KanbanBoards.default_values_list())

      [] ->
        Map.put(params, :kanban_boards, KanbanBoards.default_values_list())

      _ ->
        params
    end
  end

  defp normalize_kanban_boards(params), do: params

  defp validate_kanban_boards(changeset) do
    validate_change(changeset, :kanban_boards, fn :kanban_boards, values ->
      cond do
        is_nil(values) ->
          []

        not is_list(values) ->
          [kanban_boards: "contains unsupported kanban boards"]

        not Enum.all?(values, &(&1 in KanbanBoards.values_list())) ->
          [kanban_boards: "contains unsupported kanban boards"]

        length(values) != length(Enum.uniq(values)) ->
          [kanban_boards: "contains duplicate kanban boards"]

        true ->
          []
      end
    end)
  end
end
