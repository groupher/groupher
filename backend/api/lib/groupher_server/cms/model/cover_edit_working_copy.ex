defmodule GroupherServer.CMS.Model.CoverEditWorkingCopy do
  @moduledoc """
  Stores one mutable CoverEdit canvas owned by an Article WorkingCopy.

      WorkingCopy save patch -> CoverEdit changeset -> CoverEditWorkingCopy row
  """
  use Ecto.Schema
  import Ecto.Changeset
  alias Helper.Constant.DBPrefix

  @primary_key {:id, Ecto.UUID, autogenerate: true}
  @schema_prefix DBPrefix.cms()

  schema "cover_edit_working_copies" do
    field(:format_version, :integer, default: 1)
    field(:canvas_width, :integer)
    field(:canvas_height, :integer)
    field(:light, :map, default: %{})
    field(:dark, :map, default: %{})
    timestamps(type: :utc_datetime)
  end

  def changeset(%__MODULE__{} = cover, attrs) do
    cover
    |> cast(attrs, [:format_version, :canvas_width, :canvas_height, :light, :dark])
    |> validate_required([:format_version, :light, :dark])
    |> validate_number(:format_version, greater_than: 0)
    |> validate_number(:canvas_width, greater_than: 0)
    |> validate_number(:canvas_height, greater_than: 0)
    |> check_constraint(:format_version, name: :cover_edit_working_copies_version_check)
  end
end
