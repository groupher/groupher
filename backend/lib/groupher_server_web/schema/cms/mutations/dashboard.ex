defmodule GroupherServerWeb.Schema.CMS.Mutations.Dashboard do
  @moduledoc """
  CMS mutations for post
  """
  use Helper.GqlSchemaSuite

  import GroupherServerWeb.Schema.Helper.Fields, only: [dashboard_args: 1]

  object :cms_dashboard_mutations do
    @desc "update baseinfo in dashboard"
    field :update_dashboard_base_info, :community do
      arg(:community, non_null(:string))
      arg(:dashboard_section, :dashboard_section, default_value: :base_info)

      dashboard_args(:base_info)

      middleware(M.Authorize, :login)
      # middleware(M.Passport, claim: "cms->community.update")

      # middleware(M.PublishThrottle)
      # middleware(M.PublishThrottle, interval: 3, hour_limit: 15, day_limit: 30)
      resolve(&R.CMS.update_dashboard/3)
    end

    @desc "update seo in dashboard"
    field :update_dashboard_seo, :community do
      arg(:community, non_null(:string))
      arg(:dashboard_section, :dashboard_section, default_value: :seo)

      dashboard_args(:seo)

      middleware(M.Authorize, :login)
      # middleware(M.Passport, claim: "cms->community.update")

      # middleware(M.PublishThrottle)
      # middleware(M.PublishThrottle, interval: 3, hour_limit: 15, day_limit: 30)
      resolve(&R.CMS.update_dashboard/3)
    end

    @desc "update wallpaper in dashboard"
    field :update_dashboard_wallpaper, :community do
      arg(:community, non_null(:string))
      arg(:dashboard_section, :dashboard_section, default_value: :wallpaper)

      dashboard_args(:wallpaper)

      middleware(M.Authorize, :login)
      # middleware(M.Passport, claim: "cms->community.update")

      # middleware(M.PublishThrottle)
      # middleware(M.PublishThrottle, interval: 3, hour_limit: 15, day_limit: 30)
      resolve(&R.CMS.update_dashboard/3)
    end

    @desc "update enable in dashboard"
    field :update_dashboard_enable, :community do
      arg(:community, non_null(:string))
      arg(:dashboard_section, :dashboard_section, default_value: :enable)

      dashboard_args(:enable)

      middleware(M.Authorize, :login)
      # middleware(M.Passport, claim: "cms->community.update")

      # middleware(M.PublishThrottle)
      middleware(M.PublishThrottle, interval: 3, hour_limit: 100, day_limit: 100)
      resolve(&R.CMS.update_dashboard/3)
    end

    @desc "update layout in dashboard"
    field :update_dashboard_layout, :community do
      arg(:community, non_null(:string))
      arg(:dashboard_section, :dashboard_section, default_value: :layout)

      dashboard_args(:layout)
      arg(:kanban_bg_colors, list_of(:string))

      middleware(M.Authorize, :login)
      # middleware(M.Passport, claim: "cms->community.update")

      # middleware(M.PublishThrottle)
      # middleware(M.PublishThrottle, interval: 3, hour_limit: 15, day_limit: 30)
      resolve(&R.CMS.update_dashboard/3)
    end

    @desc "update rss in dashboard"
    field :update_dashboard_rss, :community do
      arg(:community, non_null(:string))
      arg(:dashboard_section, :dashboard_section, default_value: :rss)

      dashboard_args(:rss)

      middleware(M.Authorize, :login)
      middleware(M.Passport, claim: "cms->community.update")

      # middleware(M.PublishThrottle)
      middleware(M.PublishThrottle, interval: 3, hour_limit: 15, day_limit: 30)
      resolve(&R.CMS.update_dashboard/3)
    end

    @desc "update name alias in dashboard"
    field :update_dashboard_name_alias, :community do
      arg(:community, non_null(:string))
      arg(:dashboard_section, :dashboard_section, default_value: :name_alias)

      arg(:name_alias, list_of(:dashboard_alias_map))

      middleware(M.Authorize, :login)
      # middleware(M.Passport, claim: "cms->community.update")

      # middleware(M.PublishThrottle)
      # middleware(M.PublishThrottle, interval: 3, hour_limit: 15, day_limit: 30)
      resolve(&R.CMS.update_dashboard/3)
    end

    @desc "update header links in dashboard"
    field :update_dashboard_header_links, :community do
      arg(:community, non_null(:string))
      arg(:dashboard_section, :dashboard_section, default_value: :header_links)

      arg(:header_links, list_of(:dashboard_link_map))

      middleware(M.Authorize, :login)
      # middleware(M.Passport, claim: "cms->community.update")

      # middleware(M.PublishThrottle)
      # middleware(M.PublishThrottle, interval: 3, hour_limit: 15, day_limit: 30)
      resolve(&R.CMS.update_dashboard/3)
    end

    @desc "update footer links in dashboard"
    field :update_dashboard_footer_links, :community do
      arg(:community, non_null(:string))
      arg(:dashboard_section, :dashboard_section, default_value: :footer_links)

      arg(:footer_links, list_of(:dashboard_link_map))

      middleware(M.Authorize, :login)
      # middleware(M.Passport, claim: "cms->community.update")

      # middleware(M.PublishThrottle)
      # middleware(M.PublishThrottle, interval: 3, hour_limit: 15, day_limit: 30)
      resolve(&R.CMS.update_dashboard/3)
    end

    @desc "update social links in dashboard"
    field :update_dashboard_social_links, :community do
      arg(:community, non_null(:string))
      arg(:dashboard_section, :dashboard_section, default_value: :social_links)

      arg(:social_links, list_of(:dashboard_social_link_map))

      middleware(M.Authorize, :login)
      # middleware(M.Passport, claim: "cms->community.update")

      # middleware(M.PublishThrottle)
      # middleware(M.PublishThrottle, interval: 3, hour_limit: 15, day_limit: 30)
      resolve(&R.CMS.update_dashboard/3)
    end

    @desc "update media reports in dashboard"
    field :update_dashboard_media_reports, :community do
      arg(:community, non_null(:string))
      arg(:dashboard_section, :dashboard_section, default_value: :media_reports)
      arg(:media_reports, list_of(:dashboard_media_report_map))

      middleware(M.Authorize, :login)
      # middleware(M.Passport, claim: "cms->community.update")

      # middleware(M.PublishThrottle)
      # middleware(M.PublishThrottle, interval: 3, hour_limit: 15, day_limit: 30)
      resolve(&R.CMS.update_dashboard/3)
    end

    @desc "update faqs in dashboard"
    field :update_dashboard_faqs, :community do
      arg(:community, non_null(:string))
      arg(:dashboard_section, :dashboard_section, default_value: :faqs)

      arg(:faqs, list_of(:dashboard_faq_map))

      middleware(M.Authorize, :login)
      # middleware(M.Passport, claim: "cms->community.update")

      # middleware(M.PublishThrottle)
      # middleware(M.PublishThrottle, interval: 3, hour_limit: 15, day_limit: 30)
      resolve(&R.CMS.update_dashboard/3)
    end
  end
end
