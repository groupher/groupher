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
    |> validate_theme_overwrite()
    |> validate_kanban_boards()
  end

  defp validate_theme_overwrite(changeset) do
    changeset
    |> validate_theme_map(:theme_overwrite)
  end

  defp validate_theme_map(changeset, field) do
    validate_change(changeset, field, fn ^field, value ->
      cond do
        is_nil(value) ->
          []

        is_map(value) ->
          []

        true ->
          [{field, "must be a map"}]
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
