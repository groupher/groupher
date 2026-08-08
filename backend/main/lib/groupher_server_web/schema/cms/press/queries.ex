defmodule GroupherServerWeb.Schema.CMS.Press.Queries do
  @moduledoc "Read-only GraphQL entry points consumed by the Press app and Dashboard."

  use Helper.GqlSchemaSuite

  object :cms_press_queries do
    field :press_config, :press_config do
      arg(:community, non_null(:string))
      middleware(M.FrontDesk, :community)
      resolve(&R.CMS.press_config/3)
    end

    field :press_article, :press_article do
      arg(:article, non_null(:article_path_input))
      resolve(&R.CMS.press_article/3)
    end

    field :press_community_rss_feed, :press_community_rss_feed do
      arg(:community, non_null(:string))
      arg(:input, non_null(:press_community_rss_feed_input))
      resolve(&R.CMS.press_community_rss_feed/3)
    end

    field :press_thread_rss_feed, :press_thread_rss_feed do
      arg(:community, non_null(:string))
      arg(:thread, non_null(:thread))
      arg(:input, non_null(:press_thread_rss_feed_input))
      resolve(&R.CMS.press_thread_rss_feed/3)
    end

    field :press_site_manifest, :press_site_manifest do
      arg(:community, non_null(:string))
      resolve(&R.CMS.press_site_manifest/3)
    end
  end
end
