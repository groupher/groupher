defmodule GroupherServer.CMS.Model.Embeds.DashboardLayout do
  @type t :: %__MODULE__{}

  @moduledoc """
  general article comment meta info
  """
  use Ecto.Schema
  use Accessible

  import Ecto.Changeset

  import GroupherServerWeb.Schema.Helper.Fields,
    only: [dsb_cast_fields: 1, dsb_fields: 1]

  alias GroupherServer.CMS

  alias CMS.Helper.KanbanBoards
  alias CMS.Model.Metrics.Dashboard
  @hex_color_re ~r/^#[0-9a-fA-F]{6}$/

  @optional_fields dsb_cast_fields(:layout)
  @layout_schema Dashboard.macro_schema(:layout)
  @enum_fields Enum.flat_map(@layout_schema, fn
                 [key, :enum, _default] -> [key]
                 [key, :rainbow_color, _default] -> [key]
                 _ -> []
               end)
  @enum_array_fields Enum.flat_map(@layout_schema, fn
                       [key, {:array, :kanban_board}, _default] -> [key]
                       [key, {:array, :rainbow_color}, _default] -> [key]
                       _ -> []
                     end)

  @doc "for test usage"
  def default, do: Dashboard.layout_default()

  embedded_schema do
    dsb_fields(:layout)
  end

  @doc "for test usage"

  def changeset(struct, params) do
    params =
      params
      |> normalize_layout_enum_values()
      |> normalize_kanban_boards()

    struct
    |> cast(params, @optional_fields)
    |> validate_kanban_boards()
    |> validate_custom_colors()
  end

  defp normalize_layout_enum_values(params) when is_map(params) do
    params = Enum.reduce(@enum_fields, params, fn key, acc -> normalize_enum_param(acc, key) end)

    Enum.reduce(@enum_array_fields, params, fn key, acc ->
      normalize_enum_array_param(acc, key)
    end)
  end

  defp normalize_layout_enum_values(params), do: params

  defp normalize_enum_param(params, key) do
    case fetch_param(params, key) do
      {:ok, value} ->
        put_param(params, key, normalize_enum_value(value))

      :error ->
        params
    end
  end

  defp normalize_enum_array_param(params, key) do
    case fetch_param(params, key) do
      {:ok, values} when is_list(values) ->
        put_param(params, key, Enum.map(values, &normalize_enum_value/1))

      _ ->
        params
    end
  end

  defp fetch_param(params, key) do
    cond do
      Map.has_key?(params, key) -> {:ok, Map.get(params, key)}
      Map.has_key?(params, Atom.to_string(key)) -> {:ok, Map.get(params, Atom.to_string(key))}
      true -> :error
    end
  end

  defp put_param(params, key, value) do
    cond do
      Map.has_key?(params, key) -> Map.put(params, key, value)
      Map.has_key?(params, Atom.to_string(key)) -> Map.put(params, Atom.to_string(key), value)
      true -> params
    end
  end

  defp normalize_enum_value(value) when is_binary(value), do: String.downcase(value)
  defp normalize_enum_value(value), do: value

  defp normalize_kanban_boards(params) when is_map(params) do
    case fetch_param(params, :kanban_boards) do
      {:ok, nil} ->
        put_param(params, :kanban_boards, KanbanBoards.default_values_list())

      {:ok, []} ->
        put_param(params, :kanban_boards, KanbanBoards.default_values_list())

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
    [
      :primary_custom_color,
      :primary_custom_color_dark,
      :sub_primary_custom_color,
      :sub_primary_custom_color_dark
    ]
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
