defmodule GroupherServer.CMS.Model.CommunityDashboard do
  @type t :: %__MODULE__{}

  @moduledoc false
  alias __MODULE__

  use Ecto.Schema
  use Accessible

  import Ecto.Changeset

  alias GroupherServer.CMS
  alias Helper.Constant.DBPrefix

  alias CMS.Model.{
    Embeds,
    Community
  }

  @schema_prefix DBPrefix.cms()

  @required_fields ~w(community_id)a
  @optional_fields ~w(base_info wallpaper seo layout enable rss header_links footer_links social_links faqs)a

  def default() do
    %{
      base_info: Embeds.DashboardBaseInfo.default(),
      wallpaper: Embeds.DashboardWallpaper.default(),
      seo: Embeds.DashboardSEO.default(),
      layout: Embeds.DashboardLayout.default(),
      enable: Embeds.DashboardEnable.default(),
      rss: Embeds.DashboardRSS.default(),
      name_alias: Embeds.DashboardNameAlias.default(),
      header_links: Embeds.DashboardHeaderLink.default(),
      footer_links: Embeds.DashboardFooterLink.default(),
      social_links: Embeds.DashboardSocialLink.default(),
      media_reports: Embeds.DashboardMediaReport.default(),
      faqs: Embeds.DashboardFAQ.default()
    }
  end

  schema "community_dashboards" do
    belongs_to(:community, Community)
    embeds_one(:base_info, Embeds.DashboardBaseInfo, on_replace: :delete)
    embeds_one(:wallpaper, Embeds.DashboardWallpaper, on_replace: :delete)
    embeds_one(:seo, Embeds.DashboardSEO, on_replace: :delete)
    embeds_one(:layout, Embeds.DashboardLayout, on_replace: :delete)
    embeds_one(:enable, Embeds.DashboardEnable, on_replace: :delete)
    embeds_one(:rss, Embeds.DashboardRSS, on_replace: :delete)
    embeds_many(:name_alias, Embeds.DashboardNameAlias, on_replace: :delete)
    embeds_many(:header_links, Embeds.DashboardHeaderLink, on_replace: :delete)
    embeds_many(:footer_links, Embeds.DashboardFooterLink, on_replace: :delete)
    embeds_many(:social_links, Embeds.DashboardSocialLink, on_replace: :delete)
    embeds_many(:media_reports, Embeds.DashboardMediaReport, on_replace: :delete)
    embeds_many(:faqs, Embeds.DashboardFAQ, on_replace: :delete)

    # posts_block_list ...
    timestamps(type: :utc_datetime)
  end

  @doc false
  def changeset(%CommunityDashboard{} = community_dashboard, attrs) do
    community_dashboard
    |> cast(attrs, @required_fields)
    |> cast_embed(:base_info, with: &Embeds.DashboardBaseInfo.changeset/2)
    |> cast_embed(:wallpaper, with: &Embeds.DashboardWallpaper.changeset/2)
    |> cast_embed(:seo, with: &Embeds.DashboardSEO.changeset/2)
    |> cast_embed(:layout, with: &Embeds.DashboardLayout.changeset/2)
    |> cast_embed(:enable, with: &Embeds.DashboardEnable.changeset/2)
    |> cast_embed(:rss, with: &Embeds.DashboardRSS.changeset/2)
    |> cast_embed(:name_alias, with: &Embeds.DashboardNameAlias.changeset/2)
    |> cast_embed(:header_links, with: &Embeds.DashboardHeaderLink.changeset/2)
    |> cast_embed(:footer_links, with: &Embeds.DashboardFooterLink.changeset/2)
    |> cast_embed(:social_links, with: &Embeds.DashboardSocialLink.changeset/2)
    |> cast_embed(:faqs, with: &Embeds.DashboardFAQ.changeset/2)
  end

  @doc false
  def update_changeset(%CommunityDashboard{} = community_dashboard, attrs) do
    community_dashboard
    |> cast(attrs, @optional_fields ++ @required_fields)

    # |> cast(attrs, @optional_fields ++ @required_fields)
  end
end
