defmodule GroupherServer.CMS.Model.CommunityDashboard do
  @type t :: %__MODULE__{}

  @moduledoc """
  Ecto schema for persisted community dashboard configuration.

  The dashboard row stores editable presentation sections such as base info,
  wallpaper, SEO, layout, enabled threads, links, social links, and docs FAQ.
  Domain write helpers normalize section payloads before updating this schema.

  Business position:

      CMS context
        -> CommunityDashboard schema/changeset
        -> GroupherServer.Repo
        -> PostgreSQL
  """
  alias __MODULE__

  use Ecto.Schema
  use Accessible

  import Ecto.Changeset

  alias GroupherServer.CMS.Model.Community
  alias GroupherServer.CMS.Model.Embeds.Dashboard
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()

  @required_fields ~w(community_id)a

  @doc "Returns the default payload for every community dashboard section."
  def default do
    %{
      base_info: Dashboard.BaseInfo.default(),
      wallpaper: Dashboard.Wallpaper.default(),
      seo: Dashboard.SEO.default(),
      layout: Dashboard.Layout.default(),
      enable: Dashboard.Enable.default(),
      thread_emotions: Dashboard.ThreadEmotions.default(),
      rss: Dashboard.RSS.default(),
      name_alias: Dashboard.NameAlias.default(),
      header_links: Dashboard.Link.default(),
      footer_links: Dashboard.Link.default(),
      footer_oneline_links: Dashboard.LinkChild.default(),
      social_links: Dashboard.SocialLink.default(),
      media_reports: Dashboard.MediaReport.default(),
      doc_faq: Dashboard.DocFAQ.default(),
      third_party_analytics: Dashboard.ThirdPartyAnalytics.default()
    }
  end

  schema "community_dashboards" do
    belongs_to(:community, Community)
    field(:umami_website_id, Ecto.UUID)
    embeds_one(:base_info, Dashboard.BaseInfo, on_replace: :delete)
    embeds_one(:wallpaper, Dashboard.Wallpaper, on_replace: :delete)
    embeds_one(:seo, Dashboard.SEO, on_replace: :delete)
    embeds_one(:layout, Dashboard.Layout, on_replace: :delete)
    embeds_one(:enable, Dashboard.Enable, on_replace: :delete)
    embeds_one(:thread_emotions, Dashboard.ThreadEmotions, on_replace: :delete)
    embeds_one(:rss, Dashboard.RSS, on_replace: :delete)
    embeds_many(:name_alias, Dashboard.NameAlias, on_replace: :delete)
    embeds_many(:header_links, Dashboard.Link, on_replace: :delete)
    embeds_many(:footer_links, Dashboard.Link, on_replace: :delete)
    embeds_many(:footer_oneline_links, Dashboard.LinkChild, on_replace: :delete)
    embeds_many(:social_links, Dashboard.SocialLink, on_replace: :delete)
    embeds_many(:media_reports, Dashboard.MediaReport, on_replace: :delete)
    embeds_one(:doc_faq, Dashboard.DocFAQ, on_replace: :delete)
    embeds_many(:third_party_analytics, Dashboard.ThirdPartyAnalytics, on_replace: :delete)

    # posts_block_list ...
    timestamps(type: :utc_datetime)
  end

  @doc false
  def changeset(%CommunityDashboard{} = community_dashboard, attrs) do
    community_dashboard
    |> cast(attrs, @required_fields)
    |> cast_embed(:base_info, with: &Dashboard.BaseInfo.changeset/2)
    |> cast_embed(:wallpaper, with: &Dashboard.Wallpaper.changeset/2)
    |> cast_embed(:seo, with: &Dashboard.SEO.changeset/2)
    |> cast_embed(:layout, with: &Dashboard.Layout.changeset/2)
    |> cast_embed(:enable, with: &Dashboard.Enable.changeset/2)
    |> cast_embed(:thread_emotions, with: &Dashboard.ThreadEmotions.changeset/2)
    |> cast_embed(:rss, with: &Dashboard.RSS.changeset/2)
    |> cast_embed(:name_alias, with: &Dashboard.NameAlias.changeset/2)
    |> cast_embed(:header_links, with: &Dashboard.Link.changeset/2)
    |> cast_embed(:footer_links, with: &Dashboard.Link.changeset/2)
    |> cast_embed(:footer_oneline_links, with: &Dashboard.LinkChild.changeset/2)
    |> cast_embed(:social_links, with: &Dashboard.SocialLink.changeset/2)
    |> cast_embed(:media_reports, with: &Dashboard.MediaReport.changeset/2)
    |> cast_embed(:doc_faq, with: &Dashboard.DocFAQ.changeset/2)
    |> cast_embed(:third_party_analytics,
      with: &Dashboard.ThirdPartyAnalytics.changeset/2
    )
  end

  @doc false
  def update_changeset(%CommunityDashboard{} = community_dashboard, attrs) do
    cast(community_dashboard, attrs, [:umami_website_id])
  end
end
