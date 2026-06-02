defmodule GroupherServer.CMS.Model.CommunityDashboard do
  @type t :: %__MODULE__{}

  @moduledoc false
  alias __MODULE__

  use Ecto.Schema
  use Accessible

  import Ecto.Changeset

  alias GroupherServer.CMS

  alias CMS.Model.{Community, Embeds}
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()

  @required_fields ~w(community_id)a
  @optional_fields ~w(base_info wallpaper seo layout enable thread_emotions rss header_links footer_links footer_oneline_links social_links doc_faq)a

  def default do
    %{
      base_info: Embeds.Dashboard.BaseInfo.default(),
      wallpaper: Embeds.Dashboard.Wallpaper.default(),
      seo: Embeds.Dashboard.SEO.default(),
      layout: Embeds.Dashboard.Layout.default(),
      enable: Embeds.Dashboard.Enable.default(),
      thread_emotions: Embeds.Dashboard.ThreadEmotions.default(),
      rss: Embeds.Dashboard.RSS.default(),
      name_alias: Embeds.Dashboard.NameAlias.default(),
      header_links: Embeds.Dashboard.Link.default(),
      footer_links: Embeds.Dashboard.Link.default(),
      footer_oneline_links: Embeds.Dashboard.LinkChild.default(),
      social_links: Embeds.Dashboard.SocialLink.default(),
      media_reports: Embeds.Dashboard.MediaReport.default(),
      doc_faq: Embeds.Dashboard.DocFAQ.default()
    }
  end

  schema "community_dashboards" do
    belongs_to(:community, Community)
    embeds_one(:base_info, Embeds.Dashboard.BaseInfo, on_replace: :delete)
    embeds_one(:wallpaper, Embeds.Dashboard.Wallpaper, on_replace: :delete)
    embeds_one(:seo, Embeds.Dashboard.SEO, on_replace: :delete)
    embeds_one(:layout, Embeds.Dashboard.Layout, on_replace: :delete)
    embeds_one(:enable, Embeds.Dashboard.Enable, on_replace: :delete)
    embeds_one(:thread_emotions, Embeds.Dashboard.ThreadEmotions, on_replace: :delete)
    embeds_one(:rss, Embeds.Dashboard.RSS, on_replace: :delete)
    embeds_many(:name_alias, Embeds.Dashboard.NameAlias, on_replace: :delete)
    embeds_many(:header_links, Embeds.Dashboard.Link, on_replace: :delete)
    embeds_many(:footer_links, Embeds.Dashboard.Link, on_replace: :delete)
    embeds_many(:footer_oneline_links, Embeds.Dashboard.LinkChild, on_replace: :delete)
    embeds_many(:social_links, Embeds.Dashboard.SocialLink, on_replace: :delete)
    embeds_many(:media_reports, Embeds.Dashboard.MediaReport, on_replace: :delete)
    embeds_one(:doc_faq, Embeds.Dashboard.DocFAQ, on_replace: :delete)

    # posts_block_list ...
    timestamps(type: :utc_datetime)
  end

  @doc false
  def changeset(%CommunityDashboard{} = community_dashboard, attrs) do
    community_dashboard
    |> cast(attrs, @required_fields)
    |> cast_embed(:base_info, with: &Embeds.Dashboard.BaseInfo.changeset/2)
    |> cast_embed(:wallpaper, with: &Embeds.Dashboard.Wallpaper.changeset/2)
    |> cast_embed(:seo, with: &Embeds.Dashboard.SEO.changeset/2)
    |> cast_embed(:layout, with: &Embeds.Dashboard.Layout.changeset/2)
    |> cast_embed(:enable, with: &Embeds.Dashboard.Enable.changeset/2)
    |> cast_embed(:thread_emotions, with: &Embeds.Dashboard.ThreadEmotions.changeset/2)
    |> cast_embed(:rss, with: &Embeds.Dashboard.RSS.changeset/2)
    |> cast_embed(:name_alias, with: &Embeds.Dashboard.NameAlias.changeset/2)
    |> cast_embed(:header_links, with: &Embeds.Dashboard.Link.changeset/2)
    |> cast_embed(:footer_links, with: &Embeds.Dashboard.Link.changeset/2)
    |> cast_embed(:footer_oneline_links, with: &Embeds.Dashboard.LinkChild.changeset/2)
    |> cast_embed(:social_links, with: &Embeds.Dashboard.SocialLink.changeset/2)
    |> cast_embed(:media_reports, with: &Embeds.Dashboard.MediaReport.changeset/2)
    |> cast_embed(:doc_faq, with: &Embeds.Dashboard.DocFAQ.changeset/2)
  end

  @doc false
  def update_changeset(%CommunityDashboard{} = community_dashboard, attrs) do
    community_dashboard
    |> cast(attrs, @optional_fields ++ @required_fields)

    # |> cast(attrs, @optional_fields ++ @required_fields)
  end
end
