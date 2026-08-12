defmodule GroupherServerWeb.Schema.CMS.Queries do
  @moduledoc """
  Public CMS query fields exposed in the GraphQL schema.

  This module defines read-only CMS entry points consumed by clients in
  GraphQL Playground, including communities, categories, comments, reports,
  and dashboard-related query surfaces.
  """
  import GroupherServerWeb.Schema.Helper.Queries

  use Helper.GqlSchemaSuite

  alias GroupherServer.CMS.Dashboard.{ThemePreset, ThirdPartyAnalytics}

  object :cms_queries do
    @desc "Current user's Apply admission state and blocking application"
    field :community_application_state, non_null(:community_application_state) do
      middleware(M.Authorize, :login)
      resolve(&R.CMS.community_application_state/3)
    end

    @desc "One Community Application owned by the current user"
    field :community_application, :community_application do
      arg(:ref, non_null(:id))
      middleware(M.Authorize, :login)
      resolve(&R.CMS.community_application/3)
    end

    @desc "Reviewer-scoped detail for any Community Application"
    field :review_community_application, :community_application do
      arg(:ref, non_null(:id))
      middleware(M.Authorize, :login)
      middleware(M.Passport, action: "community.application.review")
      resolve(&R.CMS.review_community_application/3)
    end

    @desc "Reviewer-scoped Community Application queue"
    field :paged_community_applications, non_null(:community_application_connection) do
      arg(:filter, non_null(:community_applications_filter))
      arg(:after, :string)
      arg(:first, :integer, default_value: 20)
      middleware(M.Authorize, :login)
      middleware(M.Passport, action: "community.application.review")
      resolve(&R.CMS.paged_community_applications/3)
    end

    @desc "Server-trusted origin metadata for an Application Logo"
    field :community_application_logo_origin_info, :application_logo_origin_info do
      arg(:public_ref, non_null(:id))
      middleware(M.ServiceScope, audience: "phoenix:assets-api", scope: "assets:origin:read")
      resolve(&R.CMS.community_application_logo_origin_info/3)
    end

    @desc "Current Article Trash memberships"
    field :trashed_articles, :paged_trashed_articles do
      arg(:community, non_null(:string))
      arg(:thread, non_null(:thread))
      arg(:filter, :trash_filter)

      middleware(M.Authorize, :login)
      middleware(M.Passport, action: "article.trash.read")
      middleware(M.FrontDesk, :community)
      middleware(M.PageSizeProof)
      resolve(&R.CMS.trashed_articles/3)
    end

    @desc "One current Article Trash membership"
    field :trashed_article, :trashed_article do
      arg(:id, non_null(:id))
      arg(:community, non_null(:string))
      arg(:thread, non_null(:thread))

      middleware(M.Authorize, :login)
      middleware(M.Passport, action: "article.trash.read")
      middleware(M.FrontDesk, :community)
      resolve(&R.CMS.trashed_article/3)
    end

    @desc "Append-only CMS audit log"
    field :cms_audit_logs, :paged_audit_logs do
      arg(:community, non_null(:string))
      arg(:filter, :audit_log_filter)

      middleware(M.Authorize, :login)
      middleware(M.Passport, action: "audit.read")
      middleware(M.FrontDesk, :community)
      middleware(M.PageSizeProof)
      resolve(&R.CMS.cms_audit_logs/3)
    end

    @desc "Built-in community Web Analysis summary"
    field :analysis_web_summary, :analysis_web_summary do
      arg(:community, non_null(:string))
      arg(:days, :integer, default_value: 7)

      middleware(M.Authorize, :login)
      middleware(M.Passport, action: "analysis.web.read")
      middleware(M.FrontDesk, :community)
      resolve(&R.CMS.analysis_web_summary/3)
    end

    @desc "Public Umami website id for built-in community Analysis tracking"
    field :analysis_tracking_website_id, :string do
      arg(:community, non_null(:string))

      middleware(M.FrontDesk, :community)
      resolve(&R.CMS.analysis_tracking_website_id/3)
    end

    @desc "Built-in community Analysis Trends summary and chart"
    field :analysis_trends_overview, :analysis_trends_overview do
      arg(:community, non_null(:string))
      arg(:days, :integer, default_value: 7)

      middleware(M.Authorize, :login)
      middleware(M.Passport, action: "analysis.web.read")
      middleware(M.FrontDesk, :community)
      resolve(&R.CMS.analysis_trends_overview/3)
    end

    @desc "Current active visitors for the built-in community Analysis"
    field :analysis_active_visitors, :analysis_web_active do
      arg(:community, non_null(:string))

      middleware(M.Authorize, :login)
      middleware(M.Passport, action: "analysis.web.read")
      middleware(M.FrontDesk, :community)
      resolve(&R.CMS.analysis_active_visitors/3)
    end

    @desc "One built-in community Analysis page dimension"
    field :analysis_trend_pages, :analysis_trend_pages_section do
      arg(:community, non_null(:string))
      arg(:days, :integer, default_value: 7)
      arg(:dimension, non_null(:analysis_trend_pages_dimension))

      middleware(M.Authorize, :login)
      middleware(M.Passport, action: "analysis.web.read")
      middleware(M.FrontDesk, :community)
      resolve(&R.CMS.analysis_trend_pages/3)
    end

    @desc "One built-in community Analysis source dimension"
    field :analysis_trend_sources, :analysis_trend_sources_section do
      arg(:community, non_null(:string))
      arg(:days, :integer, default_value: 7)
      arg(:dimension, non_null(:analysis_trend_sources_dimension))

      middleware(M.Authorize, :login)
      middleware(M.Passport, action: "analysis.web.read")
      middleware(M.FrontDesk, :community)
      resolve(&R.CMS.analysis_trend_sources/3)
    end

    @desc "One built-in community Analysis environment dimension"
    field :analysis_trend_environment, :analysis_trend_environment_section do
      arg(:community, non_null(:string))
      arg(:days, :integer, default_value: 7)
      arg(:dimension, non_null(:analysis_trend_environment_dimension))

      middleware(M.Authorize, :login)
      middleware(M.Passport, action: "analysis.web.read")
      middleware(M.FrontDesk, :community)
      resolve(&R.CMS.analysis_trend_environment/3)
    end

    @desc "One built-in community Analysis location dimension"
    field :analysis_trend_location, :analysis_trend_location_section do
      arg(:community, non_null(:string))
      arg(:days, :integer, default_value: 7)
      arg(:dimension, non_null(:analysis_trend_location_dimension))

      middleware(M.Authorize, :login)
      middleware(M.Passport, action: "analysis.web.read")
      middleware(M.FrontDesk, :community)
      resolve(&R.CMS.analysis_trend_location/3)
    end

    @desc "UTC weekly traffic cells for built-in community Analysis"
    field :analysis_trend_traffic, :analysis_trend_traffic_section do
      arg(:community, non_null(:string))
      arg(:days, :integer, default_value: 7)

      middleware(M.Authorize, :login)
      middleware(M.Passport, action: "analysis.web.read")
      middleware(M.FrontDesk, :community)
      resolve(&R.CMS.analysis_trend_traffic/3)
    end

    @desc "dashboard theme preset registry"
    field :theme_presets, non_null(list_of(non_null(:dsb_theme_preset_option))) do
      resolve(fn _, _, _ -> {:ok, ThemePreset.options()} end)
    end

    @desc "dashboard third-party analytics provider registry"
    field :third_party_analytics_providers,
          non_null(list_of(non_null(:dsb_third_party_analytics_provider))) do
      resolve(fn _, _, _ -> {:ok, ThirdPartyAnalytics.providers()} end)
    end

    @desc "community docs side tree"
    field :doc_tree, :doc_tree do
      arg(:community, non_null(:string))

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :community)
      resolve(&R.CMS.doc_tree/3)
    end

    @desc "public community docs side tree"
    field :doc_public_tree, :doc_public_tree do
      arg(:community, non_null(:string))

      middleware(M.FrontDesk, :community)
      resolve(&R.CMS.doc_public_tree/3)
    end

    @desc "dashboard docs unified publish checklist"
    field :doc_publish_checklist, :doc_publish_checklist do
      arg(:community, non_null(:string))

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :community)
      resolve(&R.CMS.doc_publish_checklist/3)
    end

    @desc "dashboard docs trash items"
    field :doc_tree_trash_items, list_of(:doc_tree_trash_item) do
      arg(:community, non_null(:string))

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :community)
      resolve(&R.CMS.doc_tree_trash_items/3)
    end

    @desc "public community docs cover"
    field :doc_cover, :doc_cover do
      arg(:community, non_null(:string))
      arg(:view, :doc_cover_view, default_value: :public)

      middleware(M.FrontDesk, :community)
      resolve(&R.CMS.doc_cover/3)
    end

    @desc "dashboard docs editor document, preferring draft and falling back to public"
    field :doc_draft, :doc_draft do
      arg(:community, non_null(:string))
      arg(:id, non_null(:id))

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :community)
      resolve(&R.CMS.doc_draft/3)
    end

    @desc "dashboard docs draft revision history"
    field :doc_draft_snapshots, list_of(:article_snapshot) do
      arg(:community, non_null(:string))
      arg(:id, non_null(:id))
      arg(:stage, :article_snapshot_stage)
      arg(:limit, :integer, default_value: 30)

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :community)
      resolve(&R.CMS.doc_draft_snapshots/3)
    end

    @desc "one dashboard docs draft revision"
    field :doc_draft_snapshot, :article_snapshot do
      arg(:community, non_null(:string))
      arg(:id, non_null(:id))
      arg(:snapshot_id, non_null(:id))

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :community)
      resolve(&R.CMS.doc_draft_snapshot/3)
    end

    @desc "spec community info"
    field :community, :community do
      # arg(:id, non_null(:id))
      # arg(:title, :string)
      arg(:slug, non_null(:string))
      arg(:inc_views, :boolean, default_value: true)

      resolve(&R.CMS.community/3)
    end

    @desc "paged assets owned by a community"
    field :paged_community_assets, :paged_community_assets do
      arg(:community, non_null(:string))
      arg(:filter, :community_asset_filter)

      middleware(M.Authorize, :login)
      middleware(M.Passport, action: "asset.upload")
      middleware(M.FrontDesk, :community)
      middleware(M.PageSizeProof)
      resolve(&R.CMS.paged_community_assets/3)
    end

    @desc "community asset filter stats and storage quota"
    field :community_asset_stats, :community_asset_stats do
      arg(:community, non_null(:string))
      arg(:filter, :community_asset_filter)

      middleware(M.Authorize, :login)
      middleware(M.Passport, action: "asset.upload")
      middleware(M.FrontDesk, :community)
      middleware(M.PageSizeProof)
      resolve(&R.CMS.community_asset_stats/3)
    end

    @desc "community asset storage usage"
    field :community_asset_usage, :community_asset_usage do
      arg(:community, non_null(:string))

      middleware(M.Authorize, :login)
      middleware(M.Passport, action: "asset.upload")
      middleware(M.FrontDesk, :community)
      resolve(&R.CMS.community_asset_usage/3)
    end

    @desc "paged article references for one community asset"
    field :community_asset_refs, :paged_article_document_asset_refs do
      arg(:community, non_null(:string))
      arg(:asset_id, non_null(:id))
      arg(:filter, :pagi_filter)

      middleware(M.Authorize, :login)
      middleware(M.Passport, action: "asset.upload")
      middleware(M.FrontDesk, :community)
      middleware(M.PageSizeProof)
      resolve(&R.CMS.community_asset_refs/3)
    end

    @desc "service-scoped public-read origin metadata for one community asset"
    field :community_asset_origin_info, :community_asset_origin_info do
      arg(:public_ref, non_null(:string))

      middleware(M.ServiceScope, audience: "phoenix:assets-api", scope: "assets:origin:read")
      resolve(&R.CMS.community_asset_origin_info/3)
    end

    @desc "Get all passport rules available to the current user."
    field :all_passport_rules, :all_rules do
      middleware(M.Authorize, :login)
      resolve(&R.CMS.all_passport_rules/3)
    end

    @desc "if the community exist or not"
    field :is_community_exist, :check_state do
      arg(:slug, non_null(:string))

      middleware(M.Authorize, :login)
      resolve(&R.CMS.community_exist?/3)
    end

    @desc "communities with pagination info"
    field :paged_communities, :paged_communities do
      arg(:filter, non_null(:communities_filter))

      middleware(M.PageSizeProof)
      resolve(&R.CMS.paged_communities/3)
    end

    @desc "paged subscribers of a community"
    field :paged_community_subscribers, :paged_users do
      arg(:community, non_null(:string))
      arg(:filter, :pagi_filter)

      middleware(M.PageSizeProof)
      resolve(&R.CMS.paged_community_subscribers/3)
    end

    @desc "paged subscribers of a community"
    field :paged_community_moderators, :paged_users do
      arg(:community, non_null(:string))
      arg(:filter, :pagi_filter)

      middleware(M.PageSizeProof)
      resolve(&R.CMS.paged_community_moderators/3)
    end

    @desc "get all categories"
    field :paged_categories, :paged_categories do
      arg(:filter, :pagi_filter)

      middleware(M.PageSizeProof)
      resolve(&R.CMS.paged_categories/3)
    end

    @desc "get community tag groups"
    field :community_tag_groups, list_of(:community_tag_group) do
      arg(:community, non_null(:string))
      arg(:thread, :thread, default_value: :post)

      resolve(&R.CMS.community_tag_groups/3)
    end

    @desc "get community tag stats by community, thread and slug"
    field :community_tag_stats, :community_tag_stat do
      arg(:community, non_null(:string))
      arg(:thread, non_null(:thread))
      arg(:slug, non_null(:string))

      resolve(&R.CMS.community_tag_stats/3)
    end

    @desc "got basic comments state"
    field :comments_state, :comments_list_state do
      arg(:article, non_null(:article_path_input))
      arg(:freshkey, :string)

      middleware(M.FrontDesk, :article)
      resolve(&R.CMS.comments_state/3)
    end

    @desc "got spec comment by ref"
    field :one_comment, :comment do
      arg(:comment, non_null(:comment_path_input))

      middleware(M.FrontDesk, :comment)
      resolve(&R.CMS.one_comment/3)
    end

    @desc "get paged article comments"
    field :paged_comments, :paged_comments do
      arg(:article, non_null(:article_path_input))
      arg(:mode, :comments_mode, default_value: :replies)
      arg(:filter, :comments_filter)

      middleware(M.FrontDesk, :article)
      middleware(M.PageSizeProof)
      resolve(&R.CMS.paged_comments/3)
    end

    @desc "get paged article comments participants"
    field :paged_comments_participants, :paged_users do
      arg(:article, non_null(:article_path_input))
      arg(:filter, :pagi_filter)

      middleware(M.FrontDesk, :article)
      middleware(M.PageSizeProof)
      resolve(&R.CMS.paged_comments_participants/3)
    end

    @desc "get paged replies of a comment"
    field :paged_comment_replies, :paged_comment_replies do
      arg(:comment, non_null(:comment_path_input))
      arg(:filter, :comments_filter)

      middleware(M.PageSizeProof)
      middleware(M.FrontDesk, :comment)
      resolve(&R.CMS.paged_comment_replies/3)
    end

    @desc "paged reports list"
    field :paged_abuse_reports, :paged_reports do
      arg(:filter, non_null(:report_filter))

      resolve(&R.CMS.paged_reports/3)
    end

    @desc "mentions created by an artiment"
    field :mentions, :paged_mentions do
      arg(:source, non_null(:mention_source_input))
      arg(:filter, :pagi_filter)

      middleware(M.PageSizeProof)
      resolve(&R.CMS.mentions/3)
    end

    @desc "artiments mentioning an internal target"
    field :mentioned_by, :paged_mentions do
      arg(:target, non_null(:mention_target_input))
      arg(:filter, :pagi_filter)

      middleware(M.PageSizeProof)
      resolve(&R.CMS.mentioned_by/3)
    end

    @desc "search communities by title"
    field :search_communities, :paged_communities do
      arg(:title, non_null(:string))
      arg(:category, :string)

      resolve(&R.CMS.search_communities/3)
    end

    @desc "kanban posts grouped by backlog/todo/wip/done/rejected"
    field :grouped_kanban_posts, :kanban_posts do
      arg(:community, non_null(:string))

      middleware(M.FrontDesk, :community)
      resolve(&R.CMS.grouped_kanban_posts/3)
    end

    @desc "get open graph info by url"
    field :open_graph_info, :open_graph do
      arg(:url, non_null(:string))

      middleware(M.Authorize, :login)
      resolve(&R.CMS.open_graph_info/3)
    end

    @desc "paged kanban posts by status"
    field :paged_kanban_posts, :paged_posts do
      arg(:community, non_null(:string))
      arg(:filter, non_null(:paged_kanban_posts_filter))

      middleware(M.FrontDesk, :community)
      resolve(&R.CMS.paged_kanban_posts/3)
    end

    @desc "Search Article and Comment content through the unified Artiment index"
    field :search_artiments, non_null(:paged_search_artiments) do
      arg(:query, non_null(:search_artiments_query_input))

      resolve(&R.CMS.search_artiments/3)
    end

    article_reacted_users_query(:upvote, &R.CMS.upvoted_users/3)
    article_reacted_users_query(:collect, &R.CMS.collected_users/3)

    article_queries()
  end
end
