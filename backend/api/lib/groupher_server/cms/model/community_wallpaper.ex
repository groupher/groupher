defmodule GroupherServer.CMS.Model.CommunityWallpaper do
  @moduledoc """
  Current active Wallpaper Snapshot pointers for one community.

  Wallpaper save -> lock community aggregate -> update one theme pointer and
  version -> Static and Editor readers.
  """

  use Ecto.Schema

  import Ecto.Changeset

  alias GroupherServer.CMS

  alias CMS.Model.Community
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()

  schema "community_wallpapers" do
    belongs_to(:community, Community)
    field(:public_ref, :string)
    field(:version, :integer, default: 0)
    field(:active_light_snapshot_ref, :string)
    field(:active_dark_snapshot_ref, :string)

    timestamps(type: :utc_datetime)
  end

  @doc "Validates the aggregate before an atomic active-pointer update."
  def changeset(state, attrs) do
    state
    |> cast(attrs, [
      :community_id,
      :public_ref,
      :version,
      :active_light_snapshot_ref,
      :active_dark_snapshot_ref
    ])
    |> validate_required([:community_id, :public_ref, :version])
    |> validate_number(:version, greater_than_or_equal_to: 0)
    |> unique_constraint(:community_id, name: :community_wallpapers_community_id_index)
    |> unique_constraint(:public_ref, name: :community_wallpapers_public_ref_index)
  end
end
