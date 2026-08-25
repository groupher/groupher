defmodule GroupherServer.CMS.Model.Embeds.Dashboard.Wallpaper do
  @type t :: %__MODULE__{}

  @moduledoc """
  Embedded light/dark wallpaper configuration for a community dashboard.

  Business position:

      CMS context
        -> Wallpaper schema/changeset
        -> GroupherServer.Repo
        -> PostgreSQL
  """
  use Ecto.Schema
  use Accessible

  import Ecto.Changeset

  alias GroupherServer.CMS.Dashboard.Fields

  import GroupherServerWeb.Schema.Helper.Fields, only: [dsb_fields: 1]

  @doc "for test usage"
  def default, do: Fields.wallpaper_default()

  @primary_key false
  embedded_schema do
    embeds_one(:light, __MODULE__.BgConfig, on_replace: :update)
    embeds_one(:dark, __MODULE__.BgConfig, on_replace: :update)
  end

  def changeset(struct, params) do
    struct
    |> cast(params, [])
    |> cast_embed(:light, with: &__MODULE__.BgConfig.changeset/2)
    |> cast_embed(:dark, with: &__MODULE__.BgConfig.changeset/2)
  end

  defmodule BgConfig do
    @moduledoc """
    Embedded schema for one theme branch of dashboard wallpaper config.

    The fields are generated from dashboard GraphQL field metadata and validated
    through `BgConfigValidator` so frontend wallpaper controls and backend
    storage share the same accepted shape.

    Business position:

        Dashboard wallpaper mutation
          -> Wallpaper changeset
          -> BgConfig validation
          -> CommunityDashboard row
    """

    use Ecto.Schema
    use Accessible

    import Ecto.Changeset
    import GroupherServerWeb.Schema.Helper.Fields, only: [dsb_cast_fields: 1, dsb_fields: 1]

    alias GroupherServer.CMS.Model.BgConfigValidator

    @optional_fields dsb_cast_fields(:wallpaper_bg)

    @primary_key false
    embedded_schema do
      dsb_fields(:wallpaper_bg)
    end

    def changeset(struct, params) do
      struct
      |> cast(params, @optional_fields)
      |> BgConfigValidator.validate()
    end
  end
end
