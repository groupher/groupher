defmodule GroupherServer.CMS.Model.CoverEditSnapshot do
  @moduledoc """
  Stores an immutable CoverEdit canvas captured with one Article Snapshot.

      CoverEditWorkingCopy -> Snapshotter -> CoverEditSnapshot row
  """
  use Ecto.Schema
  import Ecto.Changeset
  alias Helper.Constant.DBPrefix

  @primary_key {:id, Ecto.UUID, autogenerate: true}
  @schema_prefix DBPrefix.cms()

  schema "cover_edit_snapshots" do
    field(:format_version, :integer)
    field(:canvas_width, :integer)
    field(:canvas_height, :integer)
    field(:light, :map)
    field(:dark, :map)
    field(:captured_at, :utc_datetime)
    timestamps(type: :utc_datetime, updated_at: false)
  end

  def changeset(%__MODULE__{} = snapshot, attrs) do
    snapshot
    |> cast(attrs, [:format_version, :canvas_width, :canvas_height, :light, :dark, :captured_at])
    |> validate_required([:format_version, :light, :dark, :captured_at])
    |> validate_number(:format_version, greater_than: 0)
    |> validate_number(:canvas_width, greater_than: 0)
    |> validate_number(:canvas_height, greater_than: 0)
    |> check_constraint(:format_version, name: :cover_edit_snapshots_version_check)
  end
end
