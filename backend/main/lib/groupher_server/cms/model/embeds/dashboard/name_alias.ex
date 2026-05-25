defmodule GroupherServer.CMS.Model.Embeds.Dashboard.NameAlias do
  @type t :: %__MODULE__{}

  @moduledoc """
  general article comment meta info
  """
  use Ecto.Schema
  use Accessible

  import Ecto.Changeset

  import GroupherServerWeb.Schema.Helper.Fields,
    only: [dsb_cast_fields: 1, dsb_default: 1, dsb_fields: 1]

  @optional_fields dsb_cast_fields(:name_alias)

  @doc "for test usage"
  def default do
    [
      dsb_default(:name_alias)
    ]
  end

  embedded_schema do
    dsb_fields(:name_alias)
  end

  def changeset(struct, params) do
    struct
    |> cast(params, @optional_fields)
  end
end
