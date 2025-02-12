defmodule GroupherServer.CMS.Model.Embeds.DashboardFooterLink do
  @moduledoc """
  general article comment meta info
  """
  use Ecto.Schema
  use Accessible

  import Ecto.Changeset

  import GroupherServerWeb.Schema.Helper.Fields,
    only: [dashboard_cast_fields: 1, dashboard_default: 1, dashboard_fields: 1]

  @optional_fields dashboard_cast_fields(:footer_link)

  @doc "for test usage"
  def default() do
    [
      dashboard_default(:footer_link)
    ]
  end

  embedded_schema do
    dashboard_fields(:footer_link)
  end

  def changeset(struct, params) do
    struct
    |> cast(params, @optional_fields)
  end
end
