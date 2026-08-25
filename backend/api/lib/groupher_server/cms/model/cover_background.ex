defmodule GroupherServer.CMS.Model.CoverBackground do
  @moduledoc """
  Ecto schema for reusable cover background assets.

  Cover editing stores background choices by id so article/doc cover payloads can
  reuse curated background definitions instead of duplicating image metadata.

  Business position:

      CMS context
        -> CoverBackground schema/changeset
        -> GroupherServer.Repo
        -> PostgreSQL
  """

  alias __MODULE__

  use Ecto.Schema
  use Accessible

  import Ecto.Changeset
  import GroupherServerWeb.Schema.Helper.Fields, only: [dsb_cast_fields: 1, dsb_fields: 1]

  alias GroupherServer.CMS.Model.BgConfigValidator
  alias Helper.Constant.DBPrefix

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
