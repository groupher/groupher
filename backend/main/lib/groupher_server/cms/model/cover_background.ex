defmodule GroupherServer.CMS.Model.CoverBackground do
  @moduledoc false

  alias __MODULE__

  use Ecto.Schema
  use Accessible

  import Ecto.Changeset
  import GroupherServerWeb.Schema.Helper.Fields, only: [dsb_cast_fields: 1, dsb_fields: 1]

  alias Helper.Constant.DBPrefix
  alias GroupherServer.CMS.Model.BgConfigValidator

  @schema_prefix DBPrefix.cms()
  @timestamps_opts [type: :utc_datetime]

  @optional_fields dsb_cast_fields(:wallpaper_bg)

  @type t :: %CoverBackground{}

  schema "cover_backgrounds" do
    dsb_fields(:wallpaper_bg)

    timestamps(type: :utc_datetime)
  end

  def changeset(%CoverBackground{} = background, attrs) do
    background
    |> cast(attrs, @optional_fields)
    |> BgConfigValidator.validate()
  end

  def update_changeset(%CoverBackground{} = background, attrs), do: changeset(background, attrs)
end
