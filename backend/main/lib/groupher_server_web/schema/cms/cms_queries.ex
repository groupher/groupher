defmodule GroupherServerWeb.Schema.CMS.Queries do
  @moduledoc """
  Public CMS query fields exposed in the GraphQL schema.

  This module defines read-only CMS entry points consumed by clients in
  GraphQL Playground, including communities, categories, comments, reports,
  and dashboard-related query surfaces.
  """
  import GroupherServerWeb.Schema.Helper.Queries

  use Helper.GqlSchemaSuite

  alias GroupherServer.CMS.Dashboard.ThemePreset

  object :cms_queries do
    @desc "dashboard theme preset registry"
    field :theme_presets, non_null(list_of(non_null(:dsb_theme_preset_option))) do
      resolve(fn _, _, _ -> {:ok, ThemePreset.options()} end)
    end

    @desc "community docs side tree"
    field :doc_tree, :doc_tree do
      arg(:community, non_null(:string))

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :community)
      resolve(&R.CMS.doc_tree/3)
    end

    @desc "dashboard docs draft document"
    field :doc_draft, :doc_draft do
      arg(:community, non_null(:string))
      arg(:id, non_null(:id))

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :community)
      resolve(&R.CMS.doc_draft/3)
    end

    @desc "dashboard docs draft revision history"
    field :doc_draft_revisions, list_of(:article_revision) do
      arg(:community, non_null(:string))
      arg(:id, non_null(:id))
      arg(:type, :article_revision_type)
      arg(:limit, :integer, default_value: 30)

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :community)
      resolve(&R.CMS.doc_draft_revisions/3)
    end

    @desc "one dashboard docs draft revision"
    field :doc_draft_revision, :article_revision do
      arg(:community, non_null(:string))
      arg(:id, non_null(:id))
      arg(:revision_id, non_null(:id))

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :community)
      resolve(&R.CMS.doc_draft_revision/3)
    end

    @desc "spec community info"
    field :community, :community do
      # arg(:id, non_null(:id))
      # arg(:title, :string)
      arg(:slug, non_null(:string))
      arg(:inc_views, :boolean, default_value: true)

      resolve(&R.CMS.community/3)
    end

    @desc "Get all passport rules available to the current user."
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
      arg(:article, non_null(:article_ref_input))
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
      arg(:article, non_null(:article_ref_input))
      arg(:mode, :comments_mode, default_value: :replies)
      arg(:filter, :comments_filter)

      middleware(M.PageSizeProof)
      resolve(&R.CMS.paged_comments/3)
    end

    @desc "get paged article comments participants"
    field :paged_comments_participants, :paged_users do
      arg(:article, non_null(:article_ref_input))
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

    @desc "mentions created by an artiment"
    field :mentions, :paged_mentions do
      arg(:id, non_null(:id))
      arg(:type, non_null(:mention_type))
      arg(:filter, :pagi_filter)

      middleware(M.PageSizeProof)
      resolve(&R.CMS.mentions/3)
    end

    @desc "artiments mentioning an internal target"
    field :mentioned_by, :paged_mentions do
      arg(:id, non_null(:id))
      arg(:type, non_null(:mention_type))
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

    article_search_queries()

    article_reacted_users_query(:upvote, &R.CMS.upvoted_users/3)
    article_reacted_users_query(:collect, &R.CMS.collected_users/3)

    article_queries()
  end
end
