defmodule GroupherServer.CMS.Model.WallpaperSnapshotImage do
  @moduledoc """
  One generated Profile image belonging to a Wallpaper Snapshot.

  Assets Hub claimed Profile -> Snapshot Image row -> published Wallpaper
  profile map -> StaticWallpaper.
  """

  use Ecto.Schema

  import Ecto.Changeset

  alias GroupherServer.CMS

  alias CMS.Model.WallpaperSnapshot
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()
  @profiles ~w(wide desktop tablet phone)a

  schema "wallpaper_snapshot_images" do
    field(:wallpaper_snapshot_ref, :string)
    field(:profile, Ecto.Enum, values: @profiles)
    field(:width, :integer)
    field(:height, :integer)
    field(:format, Ecto.Enum, values: [:webp])
    field(:checksum, :string)
    field(:asset_public_ref, :string)

    belongs_to(:snapshot, WallpaperSnapshot,
      foreign_key: :wallpaper_snapshot_ref,
      references: :public_ref,
      define_field: false
    )

    timestamps(type: :utc_datetime)
  end

  @doc "Validates one generated Profile image row."
  def changeset(image, attrs) do
    image
    |> cast(attrs, [
      :wallpaper_snapshot_ref,
      :profile,
      :width,
      :height,
      :format,
      :checksum,
      :asset_public_ref
    ])
    |> validate_required([
      :wallpaper_snapshot_ref,
      :profile,
      :width,
      :height,
      :format,
      :checksum,
      :asset_public_ref
    ])
    |> validate_number(:width, greater_than: 0)
    |> validate_number(:height, greater_than: 0)
    |> unique_constraint(:profile, name: :wallpaper_snapshot_images_profile_index)
  end
end
