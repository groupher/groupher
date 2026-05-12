defmodule GroupherServer.CMS.Model.Embeds.DashboardLinkChild do
  @type t :: %__MODULE__{}

  @moduledoc false
  use Ecto.Schema
  use Accessible

  import Ecto.Changeset

  @primary_key false
  embedded_schema do
    field(:id, :string)
    field(:title, :string)
    field(:url, :string)
  end

  def changeset(struct, params) do
    struct
    |> cast(params, [:id, :title, :url])
    |> validate_required([:id, :title, :url])
  end
end
