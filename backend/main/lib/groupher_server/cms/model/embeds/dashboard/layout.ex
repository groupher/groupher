defmodule GroupherServer.CMS.Model.Embeds.Dashboard.Layout do
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

  alias CMS.Dashboard.{KanbanBoards, ThemePreset}
  alias CMS.Dashboard.Fields, as: Dashboard

  @optional_fields dsb_cast_fields(:layout)

  @doc "for test usage"
  def default, do: Dashboard.layout_default()

  embedded_schema do
    dsb_fields(:layout)
  end

  @doc "for test usage"

  def changeset(struct, params) do
    struct
    |> cast(params, @optional_fields)
    |> validate_required([:kanban_boards])
    |> validate_custom_theme_preset()
    |> validate_kanban_boards()
  end

  defp validate_custom_theme_preset(changeset) do
    validate_change(changeset, :custom_theme_preset, fn :custom_theme_preset, value ->
      case ThemePreset.validate_custom_preset(value) do
        :ok -> []
        {:error, reason} -> [custom_theme_preset: reason]
      end
    end)
  end

  defp validate_kanban_boards(changeset) do
    validate_change(changeset, :kanban_boards, fn :kanban_boards, values ->
      cond do
        is_nil(values) ->
          [kanban_boards: "contains unsupported kanban boards"]

        not is_list(values) ->
          [kanban_boards: "contains unsupported kanban boards"]

        values == [] ->
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
