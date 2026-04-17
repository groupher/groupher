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
  @hex_color_re ~r/^#[0-9a-fA-F]{6}$/

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
    |> validate_custom_colors()
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

  defp validate_custom_colors(changeset) do
    [:primary_custom_color, :primary_custom_color_dark, :sub_primary_custom_color, :sub_primary_custom_color_dark]
    |> Enum.reduce(changeset, fn field, acc ->
      validate_change(acc, field, fn ^field, value ->
        cond do
          value in [nil, ""] ->
            []

          is_binary(value) and Regex.match?(@hex_color_re, value) ->
            []

          true ->
            [{field, "must be a valid hex color"}]
        end
      end)
    end)
  end
end
