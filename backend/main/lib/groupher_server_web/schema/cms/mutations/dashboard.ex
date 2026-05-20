defmodule GroupherServerWeb.Schema.CMS.Mutations.Dashboard do
  @moduledoc """
  CMS mutations for post
  """
  use Helper.GqlSchemaSuite

  import GroupherServerWeb.Schema.Helper.Fields, only: [dsb_args: 1]

  object :cms_dsb_mutations do
    @desc "update base info in dashboard"
    field :update_dashboard_base_info, :community do
      arg(:community, non_null(:string))
      arg(:dsb_section, :dsb_section, default_value: :base_info)

      dsb_args(:base_info)

      middleware(M.Authorize, :login)
      # middleware(M.PublishThrottle)
      # middleware(M.PublishThrottle, interval: 3, hour_limit: 15, day_limit: 30)
      middleware(M.FrontDesk, :community)

      resolve(&R.CMS.update_dashboard/3)
    end

    @desc "update seo in dashboard"
    field :update_dashboard_seo, :community do
      arg(:community, non_null(:string))
      arg(:dsb_section, :dsb_section, default_value: :seo)

      dsb_args(:seo)

      middleware(M.Authorize, :login)
      # middleware(M.PublishThrottle)
      # middleware(M.PublishThrottle, interval: 3, hour_limit: 15, day_limit: 30)
      middleware(M.FrontDesk, :community)

      resolve(&R.CMS.update_dashboard/3)
    end

    @desc "update wallpaper in dashboard"
    field :update_dashboard_wallpaper, :community do
      arg(:community, non_null(:string))
      arg(:dsb_section, :dsb_section, default_value: :wallpaper)

      dsb_args(:wallpaper)

      middleware(M.Authorize, :login)
      # middleware(M.PublishThrottle)
      # middleware(M.PublishThrottle, interval: 3, hour_limit: 15, day_limit: 30)
      middleware(M.FrontDesk, :community)

      resolve(&R.CMS.update_dashboard/3)
    end

    @desc "update enable in dashboard"
    field :update_dashboard_enable, :community do
      arg(:community, non_null(:string))
      arg(:dsb_section, :dsb_section, default_value: :enable)

      dsb_args(:enable)

      middleware(M.Authorize, :login)
      # middleware(M.PublishThrottle)
      middleware(M.PublishThrottle, interval: 3, hour_limit: 100, day_limit: 100)
      middleware(M.FrontDesk, :community)

      resolve(&R.CMS.update_dashboard/3)
    end

    @desc "update thread-specific emotion settings in dashboard"
    field :update_dashboard_thread_emotions, :community do
      arg(:community, non_null(:string))
      arg(:dsb_section, :dsb_section, default_value: :thread_emotions)

      arg(:post, list_of(:emotion_type))
      arg(:blog, list_of(:emotion_type))
      arg(:changelog, list_of(:emotion_type))
      arg(:doc, list_of(:emotion_type))
      arg(:post_comment, list_of(:emotion_type))
      arg(:blog_comment, list_of(:emotion_type))
      arg(:changelog_comment, list_of(:emotion_type))
      arg(:doc_comment, list_of(:emotion_type))

      middleware(M.Authorize, :login)
      middleware(M.PublishThrottle, interval: 3, hour_limit: 100, day_limit: 100)
      middleware(M.FrontDesk, :community)

      resolve(&R.CMS.update_dashboard/3)
    end

    @desc "update layout in dashboard"
    field :update_dashboard_layout, :community do
      arg(:community, non_null(:string))
      arg(:dsb_section, :dsb_section, default_value: :layout)
      arg(:theme_overwrite, :json)

      dsb_args(:layout)

      middleware(M.Authorize, :login)
      # middleware(M.PublishThrottle)
      # middleware(M.PublishThrottle, interval: 3, hour_limit: 15, day_limit: 30)
      middleware(M.FrontDesk, :community)

      resolve(&R.CMS.update_dashboard/3)
    end

    @desc "update rss in dashboard"
    field :update_dashboard_rss, :community do
      arg(:community, non_null(:string))
      arg(:dsb_section, :dsb_section, default_value: :rss)

      dsb_args(:rss)

      middleware(M.Authorize, :login)
      middleware(M.Passport, action: "dashboard.rss.update")

      # middleware(M.PublishThrottle)
      middleware(M.PublishThrottle, interval: 3, hour_limit: 15, day_limit: 30)
      middleware(M.FrontDesk, :community)

      resolve(&R.CMS.update_dashboard/3)
    end

    @desc "update name alias in dashboard"
    field :update_dashboard_name_alias, :community do
      arg(:community, non_null(:string))
      arg(:dsb_section, :dsb_section, default_value: :name_alias)

      arg(:name_alias, list_of(:dsb_alias_map))

      middleware(M.Authorize, :login)
      # middleware(M.PublishThrottle)
      # middleware(M.PublishThrottle, interval: 3, hour_limit: 15, day_limit: 30)
      middleware(M.FrontDesk, :community)

      resolve(&R.CMS.update_dashboard/3)
    end

    @desc "update header links in dashboard"
    field :update_dashboard_header_links, :community do
      arg(:community, non_null(:string))
      arg(:dsb_section, :dsb_section, default_value: :header_links)

      arg(:header_links, list_of(:dsb_link_map))

      middleware(M.Authorize, :login)
      # middleware(M.PublishThrottle)
      # middleware(M.PublishThrottle, interval: 3, hour_limit: 15, day_limit: 30)
      middleware(M.FrontDesk, :community)

      resolve(&R.CMS.update_dashboard/3)
    end

    @desc "update footer links in dashboard"
    field :update_dashboard_footer_links, :community do
      arg(:community, non_null(:string))
      arg(:dsb_section, :dsb_section, default_value: :footer_links)
      arg(:footer_links, list_of(:dsb_link_map))

      middleware(M.Authorize, :login)
      # middleware(M.PublishThrottle)
      # middleware(M.PublishThrottle, interval: 3, hour_limit: 15, day_limit: 30)
      middleware(M.FrontDesk, :community)

      resolve(&R.CMS.update_dashboard/3)
    end

    @desc "update footer oneline links in dashboard"
    field :update_dashboard_footer_oneline_links, :community do
      arg(:community, non_null(:string))
      arg(:dsb_section, :dsb_section, default_value: :footer_oneline_links)
      arg(:footer_oneline_links, list_of(:dsb_link_child_map))

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :community)

      resolve(&R.CMS.update_dashboard/3)
    end

    @desc "update social links in dashboard"
    field :update_dashboard_social_links, :community do
      arg(:community, non_null(:string))
      arg(:dsb_section, :dsb_section, default_value: :social_links)

      arg(:social_links, list_of(:dsb_social_link_map))

      middleware(M.Authorize, :login)
      # middleware(M.PublishThrottle)
      # middleware(M.PublishThrottle, interval: 3, hour_limit: 15, day_limit: 30)
      middleware(M.FrontDesk, :community)

      resolve(&R.CMS.update_dashboard/3)
    end

    @desc "update media reports in dashboard"
    field :update_dashboard_media_reports, :community do
      arg(:community, non_null(:string))
      arg(:dsb_section, :dsb_section, default_value: :media_reports)
      arg(:media_reports, list_of(:dsb_media_report_map))

      middleware(M.Authorize, :login)
      # middleware(M.PublishThrottle)
      # middleware(M.PublishThrottle, interval: 3, hour_limit: 15, day_limit: 30)
      middleware(M.FrontDesk, :community)

      resolve(&R.CMS.update_dashboard/3)
    end

    @desc "update faqs in dashboard"
    field :update_dashboard_faqs, :community do
      arg(:community, non_null(:string))
      arg(:dsb_section, :dsb_section, default_value: :faqs)

      arg(:faqs, list_of(:dsb_faq_map))

      middleware(M.Authorize, :login)
      # middleware(M.PublishThrottle)
      # middleware(M.PublishThrottle, interval: 3, hour_limit: 15, day_limit: 30)
      middleware(M.FrontDesk, :community)

      resolve(&R.CMS.update_dashboard/3)
    end
  end
end
