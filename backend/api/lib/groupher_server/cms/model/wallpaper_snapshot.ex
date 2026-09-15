defmodule GroupherServer.CMS.Model.WallpaperSnapshot do
  @moduledoc """
  Immutable successful Wallpaper save for one theme.

  Publish -> immutable Snapshot plus Images/Receipt -> active pointer,
  history, and restore.
  """

  use Ecto.Schema

  import Ecto.Changeset

  alias GroupherServer.CMS

  alias CMS.Model.{Community, WallpaperSnapshotImage}
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()
  @themes ~w(light dark)a

  schema "wallpaper_snapshots" do
    field(:public_ref, :string)
    field(:theme, Ecto.Enum, values: @themes)
    field(:settings, :map)
    field(:settings_schema_version, :integer)
    field(:source_batch_ref, :string)
    field(:profile_version, :integer)
    field(:created_by_id, :string)
    field(:activated_at, :utc_datetime)
    field(:history_used_at, :utc_datetime)
    field(:delete_after, :utc_datetime)

    belongs_to(:community, Community)

    has_many(:images, WallpaperSnapshotImage,
      foreign_key: :wallpaper_snapshot_ref,
      references: :public_ref
    )

    timestamps(type: :utc_datetime)
  end

  @doc "Validates metadata shared by rendered and NONE snapshots."
  def changeset(snapshot, attrs) do
    snapshot
    |> cast(attrs, [
      :community_id,
      :public_ref,
      :theme,
      :settings,
      :settings_schema_version,
      :source_batch_ref,
      :profile_version,
      :created_by_id,
      :activated_at,
      :history_used_at,
      :delete_after
    ])
    |> validate_required([
      :community_id,
      :public_ref,
      :theme,
      :settings,
      :settings_schema_version,
      :profile_version,
      :created_by_id,
      :activated_at,
      :history_used_at
    ])
    |> validate_number(:settings_schema_version, greater_than: 0)
    |> validate_number(:profile_version, greater_than: 0)
    |> unique_constraint(:public_ref, name: :wallpaper_snapshots_public_ref_index)
  end
end
