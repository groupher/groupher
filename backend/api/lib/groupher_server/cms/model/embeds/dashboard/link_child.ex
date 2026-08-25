defmodule GroupherServer.CMS.Model.Embeds.Dashboard.LinkChild do
  @type t :: %__MODULE__{}

  @moduledoc """
  Embedded schema for child links inside dashboard link groups.

  Child links are the flat leaf nodes rendered in header/footer dropdowns.

  Business position:

      CMS context
        -> LinkChild schema/changeset
        -> GroupherServer.Repo
        -> PostgreSQL
  """
  use Ecto.Schema
  use Accessible

  import Ecto.Changeset

  @primary_key false
  embedded_schema do
    field(:id, :string)
    field(:title, :string)
    field(:url, :string)
  end

  def default, do: []

  def changeset(struct, params) do
    struct
    |> cast(params, [:id, :title, :url])
    |> validate_required([:id, :title, :url])
  end
end
