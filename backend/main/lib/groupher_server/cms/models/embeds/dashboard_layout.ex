defmodule GroupherServer.CMS.Model.Embeds.DashboardLayout do
  @moduledoc """
  general article comment meta info
  """
  use Ecto.Schema
  use Accessible

  import Ecto.Changeset

  import GroupherServerWeb.Schema.Helper.Fields,
    only: [dashboard_cast_fields: 1, dashboard_default: 1, dashboard_fields: 1]

  @optional_fields dashboard_cast_fields(:layout) ++ [:kanban_bg_colors]

  @doc "for test usage"
  def default() do
    dashboard_default(:layout) |> Map.merge(%{kanban_bg_colors: []})
  end

  embedded_schema do
    dashboard_fields(:layout)
    field(:kanban_bg_colors, {:array, :string}, default: [])
  end

  @doc "for test usage"

  def changeset(struct, params) do
    struct
    |> cast(params, @optional_fields)
  end
end
