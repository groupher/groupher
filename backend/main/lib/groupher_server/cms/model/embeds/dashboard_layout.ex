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

  alias GroupherServer.CMS.Helper.KanbanBoards
  alias GroupherServer.CMS.Model.Metrics.Dashboard

  @optional_fields dashboard_cast_fields(:layout)

  @doc "for test usage"
  def default, do: Dashboard.layout_default()

  embedded_schema do
    dashboard_fields(:layout)
  end

  @doc "for test usage"

  def changeset(struct, params) do
    struct
    |> cast(params, @optional_fields)
    |> validate_change(:kanban_boards, fn :kanban_boards, values ->
      case Enum.all?(values, &(&1 in KanbanBoards.values_list())) do
        true -> []
        false -> [kanban_boards: "contains unsupported kanban boards"]
      end
    end)
  end
end
