defmodule GroupherServerWeb.Schema.CMS.Queries do
  @moduledoc """
  CMS queries
  """
  import GroupherServerWeb.Schema.Helper.Queries

  use Helper.GqlSchemaSuite

  object :cms_queries do
    @desc "spec community info"
    field :community, :community do
      # arg(:id, non_null(:id))
      # arg(:title, :string)
      arg(:slug, non_null(:string))
      arg(:inc_views, :boolean, default_value: true)

      resolve(&R.CMS.community/3)
    end

    @desc "get temp token for upload assets"
    field :apply_upload_tokens, :upload_tokens do
      middleware(M.Authorize, :login)
      resolve(&R.CMS.upload_tokens/3)
    end

    field :all_passport_rules, :all_rules do
      middleware(M.Authorize, :login)
      resolve(&R.CMS.all_passport_rules/3)
    end

    @desc "if use has pending apply"
    field :has_pending_community_apply, :check_state do
      middleware(M.Authorize, :login)
      resolve(&R.CMS.has_pending_community_apply?/3)
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
      arg(:id, :id)
      arg(:community, :string)
      arg(:filter, :pagi_filter)

      middleware(M.PageSizeProof)
      resolve(&R.CMS.paged_community_subscribers/3)
    end

    @desc "paged subscribers of a community"
    field :paged_community_moderators, :paged_users do
      arg(:id, non_null(:id))
      arg(:filter, :pagi_filter)

      middleware(M.PageSizeProof)
      resolve(&R.CMS.paged_community_moderators/3)
    end

    @desc "get community geo cities info"
    field :community_geo_info, list_of(:geo_info) do
      arg(:id, non_null(:id))
      arg(:slug, :string)

      resolve(&R.CMS.community_geo_info/3)
    end

    @desc "get all categories"
    field :paged_categories, :paged_categories do
      arg(:filter, :pagi_filter)

      middleware(M.PageSizeProof)
      resolve(&R.CMS.paged_categories/3)
    end

    @desc "get all the threads across all communities"
    field :paged_threads, :paged_threads do
      arg(:filter, :threads_filter)

      middleware(M.PageSizeProof)
      resolve(&R.CMS.paged_threads/3)
    end

    @desc "get paged article tags"
    field :paged_article_tags, :paged_article_tags do
      arg(:filter, :article_tags_filter)

      middleware(M.PageSizeProof)
      resolve(&R.CMS.paged_article_tags/3)
    end

    @desc "got basic comments state"
    field :comments_state, :comments_list_state do
      arg(:id, non_null(:id))
      arg(:thread, :thread, default_value: :post)
      arg(:freshkey, :string)

      resolve(&R.CMS.comments_state/3)
    end

    @desc "got spec comment by id"
    field :one_comment, :comment do
      arg(:id, non_null(:id))

      resolve(&R.CMS.one_comment/3)
    end

    @desc "get paged article comments"
    field :paged_comments, :paged_comments do
      arg(:id, non_null(:id))
      arg(:mode, :comments_mode, default_value: :replies)
      arg(:thread, :thread, default_value: :post)
      arg(:filter, :comments_filter)

      middleware(M.PageSizeProof)
      resolve(&R.CMS.paged_comments/3)
    end

    @desc "get paged article comments participants"
    field :paged_comments_participants, :paged_users do
      arg(:id, non_null(:id))
      arg(:thread, :thread, default_value: :post)
      arg(:filter, :pagi_filter)

      middleware(M.PageSizeProof)
      resolve(&R.CMS.paged_comments_participants/3)
    end

    @desc "get paged replies of a comment"
    field :paged_comment_replies, :paged_comment_replies do
      arg(:id, non_null(:id))
      arg(:filter, :comments_filter)

      middleware(M.PageSizeProof)
      resolve(&R.CMS.paged_comment_replies/3)
    end

    @desc "paged reports list"
    field :paged_abuse_reports, :paged_reports do
      arg(:filter, non_null(:report_filter))

      resolve(&R.CMS.paged_reports/3)
    end

    @desc "paged citings list"
    field :paged_citing_contents, :paged_citings do
      arg(:id, non_null(:id))
      arg(:content, :content, default_value: :post)
      arg(:filter, :pagi_filter)

      resolve(&R.CMS.paged_citing_contents/3)
    end

    @desc "search communities by title"
    field :search_communities, :paged_communities do
      arg(:title, non_null(:string))
      arg(:category, :string)

      resolve(&R.CMS.search_communities/3)
    end

    @desc "kanban posts grouped by todo/wip/done"
    field :grouped_kanban_posts, :grouped_posts do
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

    @desc "kanban posts grouped by todo/wip/done"
    field :paged_kanban_posts, :paged_posts do
      arg(:community, non_null(:string))
      arg(:filter, non_null(:paged_kanban_posts_filter))

      resolve(&R.CMS.paged_kanban_posts/3)
    end

    # this query is only use to pass the graphql type spec, real logic is in fronted
    field :client_i18n, :client_locale do
      arg(:locale, :string)

      resolve(&R.CMS.client_i18n/3)
    end

    article_search_queries()

    article_reacted_users_query(:upvote, &R.CMS.upvoted_users/3)
    article_reacted_users_query(:collect, &R.CMS.collected_users/3)

    article_queries()
  end
end
