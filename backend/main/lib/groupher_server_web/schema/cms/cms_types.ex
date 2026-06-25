defmodule GroupherServerWeb.Schema.CMS.Types do
  @moduledoc """
  GraphQL object and payload types for the CMS domain.

  These types define the user-facing CMS data contract used by query and
  mutation fields in Playground, including communities, articles, comments,
  dashboard settings, moderation payloads, and pagination wrappers.
  """
  use Helper.GqlSchemaSuite

  import GroupherServerWeb.Schema.Helper.Fields
  import GroupherServerWeb.Schema.Helper.Objects

  import Ecto.Query, warn: false
  import Absinthe.Resolution.Helpers, only: [dataloader: 2]

  alias GroupherServer.{Accounts, CMS}
  alias CMS.Marker
  alias CMS.Dashboard.ThemePreset
  alias CMS.Model.{Community, CoverBackground}
  alias Helper.ORM
  alias GroupherServerWeb.Schema

  import_types(Schema.CMS.Metrics)

  object :check_state do
    @desc "Whether the checked resource exists or condition is met."
    field(:exist, :boolean)
  end

  object :done_state do
    @desc "Whether the requested operation completed successfully."
    field(:done, :boolean)
  end

  enum :doc_tree_node_type do
    value(:group)
    value(:page)
    value(:link)
  end

  enum :article_revision_type do
    value(:draft)
    value(:published)
  end

  enum :doc_publish_mode do
    value(:with_cover_sync)
    value(:doc_only)
  end

  enum :doc_publish_status do
    value(:draft)
    value(:public)
  end

  enum :doc_cover_view do
    value(:public)
    value(:dashboard)
  end

  enum :marker_type do
    value(:icon)
    value(:emoji)
  end

  object :marker do
    field(:type, non_null(:marker_type), resolve: &resolve_marker_field(:type, &1, &2, &3))
    field(:provider, :string, resolve: &resolve_marker_field(:provider, &1, &2, &3))
    field(:name, :string, resolve: &resolve_marker_field(:name, &1, &2, &3))
    field(:src, :string, resolve: &resolve_marker_field(:src, &1, &2, &3))
    field(:unified, :string, resolve: &resolve_marker_field(:unified, &1, &2, &3))
  end

  input_object :marker_input do
    field(:type, non_null(:marker_type))
    field(:provider, :string)
    field(:name, :string)
    field(:src, :string)
    field(:unified, :string)
  end

  object :doc_tree_node do
    field(:id, :id)
    field(:parent_id, :id)
    field(:doc_id, :id)
    field(:type, :doc_tree_node_type)
    field(:title, :string)
    field(:slug, :string)
    field(:index, :integer)
    field(:href, :string)
    field(:marker, :marker)
    field(:badge, :string)
    field(:hidden, :boolean)
    field(:expanded, :boolean)
    field(:publish_state, :doc_tree_node_publish_state)
    field(:children, list_of(:doc_tree_node))
  end

  object :doc_tree_node_publish_state do
    field(:status, :doc_publish_status)
    field(:published, :boolean)
    field(:published_before, :boolean)
    field(:published_node_id, :id)
    field(:published_doc_id, :id)
    field(:has_unpublished_changes, :boolean)
    field(:last_published_at, :datetime)
    field(:in_cover, :boolean)
    field(:hidden_from_cover, :boolean)
    field(:pinned_to_cover, :boolean)
  end

  object :doc_tree do
    field(:revision, :integer)
    field(:groups, list_of(:doc_tree_node))
  end

  object :doc_cover do
    field(:groups, list_of(:doc_cover_group))
    field(:pinned_items, list_of(:doc_cover_pinned_item))
  end

  object :doc_cover_group do
    field(:id, :id)
    field(:group_id, :id)
    field(:index, :integer)
    field(:ui_config, :json)
    field(:title, :string)
    field(:group, :doc_tree_node)
    field(:items, list_of(:doc_cover_item))
  end

  object :doc_cover_item do
    field(:id, :id)
    field(:node_id, :id)
    field(:index, :integer)
    field(:hidden, :boolean)
    field(:ui_config, :json)
    field(:doc_id, :id)
    field(:type, :doc_tree_node_type)
    field(:title, :string)
    field(:href, :string)
    field(:marker, :marker)
    field(:digest, :string)
    field(:badge, :string)
    field(:node, :doc_tree_node)
  end

  object :doc_cover_pinned_item do
    field(:id, :id)
    field(:node_id, :id)
    field(:index, :integer)
    field(:ui_config, :json)
    field(:doc_id, :id)
    field(:type, :doc_tree_node_type)
    field(:title, :string)
    field(:href, :string)
    field(:marker, :marker)
    field(:digest, :string)
    field(:badge, :string)
    field(:node, :doc_tree_node)
  end

  object :doc_draft do
    field(:id, :id)
    field(:title, :string)
    field(:subtitle, :string)
    field(:slug, :string)
    field(:digest, :string)
    field(:author, :user, resolve: dataloader(CMS, :author))
    timestamp_fields()
    field(:document, :thread_document, resolve: fn draft, _, _ -> {:ok, draft} end)
  end

  object :doc_tree_mutation_payload do
    field(:revision, :integer)
    field(:node, :doc_tree_node)
    field(:affected_nodes, list_of(:doc_tree_node))
    field(:conflict, :boolean)
  end

  input_object :doc_tree_node_input do
    field(:parent_id, :id)
    field(:doc_id, :id)
    field(:title, non_null(:string))
    field(:slug, :string)
    field(:index, :integer)
    field(:href, :string)
    field(:marker, :marker_input)
    field(:badge, :string)
    field(:hidden, :boolean)
    field(:expanded, :boolean)
  end

  input_object :doc_tree_node_patch_input do
    field(:doc_id, :id)
    field(:title, :string)
    field(:slug, :string)
    field(:href, :string)
    field(:marker, :marker_input)
    field(:badge, :string)
    field(:hidden, :boolean)
    field(:expanded, :boolean)
  end

  object :dsb_theme_preset_option do
    field(:value, non_null(:dsb_theme_preset))
    field(:tokens, non_null(:json))
  end

  ######
  # common stands for minimal info of the type
  # usually used in abuse_report, feeds, etc ..
  object :common_user do
    field(:login, :string)
    field(:avatar, :string)
    field(:nickname, :string)
    field(:bio, :string)
    field(:shortbio, :string)
  end

  object :common_article do
    field(:thread, :thread)
    field(:id, :id)
    # field(:body_html, :string)
    field(:title, :string)
    field(:author, :common_user)
  end

  object :common_comment do
    field(:id, :id)
    field(:body_html, :string)
    field(:upvotes_count, :integer)
    field(:author, :common_user)
    field(:article, :common_article)
  end

  ######

  object :idlike do
    field(:id, :id)
  end

  object :thread_document do
    field(:json, :string)
    field(:markdown, :string)
    field(:markdown_toc, :json)
    field(:html, :string)
    field(:xml, :string)
    field(:rss, :string)
  end

  object :article_revision do
    field(:id, :id)
    field(:thread, :thread)
    field(:type, :article_revision_type)
    field(:article_id, :id)
    field(:article_draft_id, :id)
    field(:title, :string)
    field(:slug, :string)
    field(:subtitle, :string)
    field(:digest, :string)
    field(:document_json, :string)
    field(:content_hash, :string)
    field(:revision_number, :integer)
    field(:schema_version, :integer)
    field(:author, :user, resolve: dataloader(CMS, :author))
    timestamp_fields()
  end

  object :post do
    meta(:cache, max_age: 30)
    interface(:article)

    general_article_fields()
    comments_fields()

    field(:cat, :article_cat_enum)
    field(:status, :article_status_enum)

    timestamp_fields(:article)
  end

  object :changelog do
    meta(:cache, max_age: 30)
    interface(:article)

    general_article_fields()
    comments_fields()

    timestamp_fields(:article)
  end

  object :doc do
    meta(:cache, max_age: 30)
    interface(:article)

    general_article_fields()
    field(:subtitle, :string)
    comments_fields()

    timestamp_fields(:article)
  end

  object :blog do
    meta(:cache, max_age: 30)
    interface(:article)

    general_article_fields()
    comments_fields()

    timestamp_fields(:article)
  end

  object :contribute do
    meta(:cache, max_age: 30)
    field(:date, :date)
    field(:count, :integer)
  end

  object :contribute_map do
    meta(:cache, max_age: 30)
    field(:start_date, :date)
    field(:end_date, :date)
    field(:total_count, :integer)
    field(:records, list_of(:contribute))
  end

  object(:dsb_rss, do: dsb_gq_fields(:rss))
  object(:dsb_seo, do: dsb_gq_fields(:seo))
  object(:dsb_bg_config, do: dsb_gq_fields(:wallpaper_bg))

  object :cover_background do
    field(:id, :id)
    dsb_gq_fields(:wallpaper_bg)
  end

  object :cover_config do
    field(:background_id, :id)
    field(:original_background_id, :id)

    field :background, :cover_background do
      resolve(dataloader(CMS, &cover_background_loader(:background_id, &1, &2, &3)))
    end

    field :original_background, :cover_background do
      resolve(dataloader(CMS, &cover_background_loader(:original_background_id, &1, &2, &3)))
    end

    field(:images, list_of(:json))
  end

  object :cover_edit_info do
    field(:id, :id)
    field(:canvas_width, :integer)
    field(:canvas_height, :integer)
    field(:version, :integer)
    field(:light, :cover_config)
    field(:dark, :cover_config)

    timestamp_fields()
  end

  input_object :cover_background_input do
    dsb_input_fields(:wallpaper_bg)
  end

  input_object :cover_config_input do
    field(:background_id, :id)
    field(:background, :cover_background_input)
    field(:original_background_id, :id)
    field(:original_background, :cover_background_input)
    field(:images, list_of(:json))
  end

  input_object :cover_edit_info_input do
    field(:canvas_width, non_null(:integer))
    field(:canvas_height, non_null(:integer))
    field(:version, :integer)
    field(:light, non_null(:cover_config_input))
    field(:dark, non_null(:cover_config_input))
  end

  object :dsb_wallpaper do
    field(:light, :dsb_bg_config)
    field(:dark, :dsb_bg_config)
  end

  object :dsb_layout do
    dsb_gq_fields(:layout, except: [:custom_theme_preset])

    @desc "Base preset used by the current custom theme preset."
    field :theme_preset_base, :dsb_theme_preset do
      resolve(fn layout, _, _ ->
        # `themePresetBase` describes the saved Custom preset only. Returning
        # nil when Custom has not been created lets clients distinguish that
        # state from "Custom exists and is based on DEFAULT".
        if is_map(layout.custom_theme_preset) do
          {:ok, ThemePreset.custom_base_preset(layout.custom_theme_preset)}
        else
          {:ok, nil}
        end
      end)
    end

    @desc "Resolved design tokens for the active theme preset."
    field :theme_tokens, :json do
      resolve(fn layout, _, _ ->
        tokens =
          ThemePreset.resolve(
            layout.theme_preset,
            layout.custom_theme_preset
          )

        {:ok, tokens}
      end)
    end

    @desc "Theme preset options available for dashboard layout settings."
    field :theme_presets, list_of(:dsb_theme_preset_option) do
      resolve(fn layout, _, _ ->
        {:ok, ThemePreset.options(layout.custom_theme_preset)}
      end)
    end
  end

  object(:dsb_enable, do: dsb_gq_fields(:enable))

  object :dsb_thread_emotions do
    field(:post, list_of(:emotion_type))
    field(:blog, list_of(:emotion_type))
    field(:changelog, list_of(:emotion_type))
    field(:doc, list_of(:emotion_type))
    field(:post_comment, list_of(:emotion_type))
    field(:blog_comment, list_of(:emotion_type))
    field(:changelog_comment, list_of(:emotion_type))
    field(:doc_comment, list_of(:emotion_type))
  end

  object(:dsb_base_info, do: dsb_gq_fields(:base_info))
  object(:dsb_name_alias, do: dsb_gq_fields(:name_alias))

  object :dsb_link_child do
    field(:id, :string)
    field(:title, :string)
    field(:url, :string)
  end

  object :dsb_link do
    field(:id, :string)
    field(:type, :dsb_link_type)
    field(:title, :string)
    field(:url, :string)
    field(:links, list_of(:dsb_link_child))
  end

  object(:dsb_social_link, do: dsb_gq_fields(:social_link))
  object(:dsb_media_report, do: dsb_gq_fields(:media_report))

  object :dsb_doc_faq_item do
    field(:id, :id)
    field(:title, :string)
    field(:detail, :string)
    field(:index, :integer)
  end

  object :dsb_doc_faq_group do
    field(:id, :id)
    field(:title, :string)
    field(:index, :integer)
    field(:items, list_of(:dsb_doc_faq_item))
  end

  object :dsb_doc_faq do
    field(:title, :string)
    field(:desc, :string)
    field(:grouped_view, :boolean)
    field(:group_items, list_of(:dsb_doc_faq_group))
    field(:flat_items, list_of(:dsb_doc_faq_item))
  end

  input_object :dsb_doc_faq_item_input do
    field(:id, :string)
    field(:title, :string)
    field(:detail, :string)
    field(:index, :integer)
  end

  input_object :dsb_doc_faq_group_input do
    field(:id, :string)
    field(:title, :string)
    field(:index, :integer)
    field(:items, list_of(:dsb_doc_faq_item_input))
  end

  input_object :dsb_doc_faq_input do
    field(:title, :string)
    field(:desc, :string)
    field(:grouped_view, :boolean)
    field(:group_items, list_of(:dsb_doc_faq_group_input))
    field(:flat_items, list_of(:dsb_doc_faq_item_input))
  end

  object :dsb do
    field(:seo, :dsb_seo)
    field(:wallpaper, :dsb_wallpaper)
    field(:layout, :dsb_layout)
    field(:enable, :dsb_enable)
    field(:thread_emotions, :dsb_thread_emotions)
    field(:base_info, :dsb_base_info)
    field(:rss, :dsb_rss)
    field(:name_alias, list_of(:dsb_name_alias))
    field(:header_links, list_of(:dsb_link))
    field(:footer_links, list_of(:dsb_link))
    field(:footer_oneline_links, list_of(:dsb_link_child))
    field(:social_links, list_of(:dsb_social_link))
    field(:media_reports, list_of(:dsb_media_report))
    field(:doc_faq, :dsb_doc_faq)
  end

  object :community_moderator do
    field(:is_root, :boolean) do
      resolve(fn moderator, _, _ ->
        with {:ok, community} <- ORM.find(Community, moderator.community_id),
             {:ok, passport} <-
               CMS.Communities.get_passport(%Accounts.Model.User{id: moderator.user_id}) do
          {:ok, get_in(passport, [community.slug, "root"]) == true}
        else
          _ -> {:ok, false}
        end
      end)
    end

    field(:passport_item_count, :integer)
    field(:user, :common_user)
  end

  object :all_rules do
    field(:root, :string)
    field(:moderator, :string)
  end

  object :community do
    meta(:cache, max_age: 30)
    @desc "Community identifier."
    field(:id, :id)
    @desc "Community display title."
    field(:title, :string)
    @desc "Community introduction text."
    field(:desc, :string)
    @desc "Community slug used in API routes."
    field(:slug, :string)
    field(:favicon, :string)
    field(:homepage, :string)
    field(:index, :integer)
    field(:logo, :string)
    @desc "Community owner account."
    field(:author, :user, resolve: dataloader(CMS, :author))
    field(:locale, :string)
    field(:categories, list_of(:category), resolve: dataloader(CMS, :categories))
    @desc "Dashboard configuration for this community."
    field(:dashboard, :dsb, resolve: dataloader(CMS, :dashboard))

    # field(:moderators, list_of(:community_moderator), resolve: dataloader(CMS, moderators: :user))
    @desc "Current moderators in the community."
    field(:moderators, list_of(:community_moderator))

    field(:meta, :community_meta)
    field(:views, :integer)
    field(:contributes_digest, list_of(:integer))

    field(:articles_count, :integer)
    field(:subscribers_count, :integer)
    field(:moderators_count, :integer)

    @desc "Total number of tags configured for the community."
    field :community_tags_count, :integer do
      resolve(&R.CMS.community_tags_count/3)
    end

    @desc "Whether the current viewer has subscribed to this community."
    field(:viewer_has_subscribed, :boolean)
    @desc "Whether the current viewer is a moderator of this community."
    field(:viewer_is_moderator, :boolean)

    field(:pending, :integer)

    timestamp_fields()
  end

  object :category do
    field(:id, :id)
    field(:title, :string)
    field(:slug, :string)
    field(:index, :integer)
    field(:author, :user, resolve: dataloader(CMS, :author))
    field(:communities, list_of(:community), resolve: dataloader(CMS, :communities))

    timestamp_fields()
  end

  object :community_tag do
    field(:id, :id)
    field(:title, :string)
    field(:desc, :string)
    field(:layout, :string)
    field(:slug, :string)
    field(:color, :rainbow_color)
    field(:thread, :thread)
    field(:group, :string, resolve: &R.CMS.community_tag_group_title/3)
    field(:group_id, :id)
    field(:extra, list_of(:string))
    field(:marker, :marker)
    field(:index, :integer)

    field(:author, :user, resolve: dataloader(CMS, :author))
    field(:community, :community, resolve: dataloader(CMS, :community))
    field(:stats, :community_tag_stat, resolve: &R.CMS.community_tag_stats/3)

    timestamp_fields()
  end

  object :community_tag_group do
    field(:id, :id)
    field(:title, :string)
    field(:thread, :thread)
    field(:index, :integer)
    field(:tags, list_of(:community_tag), resolve: dataloader(CMS, :tags))

    field(:community, :community, resolve: dataloader(CMS, :community))

    timestamp_fields()
  end

  defp resolve_marker_field(field, marker, _args, _info) do
    {:ok, Marker.field(marker, field)}
  end

  object :community_tag_stat do
    field(:contents_count, :integer)
    field(:today_contents_count, :integer)
  end

  object :emotion_stat do
    field(:type, :emotion_type)
    field(:count, :integer)
    field(:viewer_has_reacted, :boolean)
    field(:latest_users, list_of(:common_user))
  end

  object :comment_meta do
    field(:is_article_author_upvoted, :boolean)
    field(:is_reply_to_others, :boolean)

    # audit states
    field(:is_legal, :boolean)
    field(:illegal_reason, list_of(:string))
    field(:illegal_words, list_of(:string))
    # field(:report_count, :boolean)
    # field(:is_solution, :boolean)
  end

  object :comment_reply do
    comment_general_fields()
  end

  object :comment do
    comment_general_fields()

    field(:replies, list_of(:comment_reply))
    field(:article, :common_article)

    field(:is_for_question, :boolean)
    field(:is_solution, :boolean)
  end

  object :comments_list_state do
    field(:total_count, :integer)
    field(:participants_count, :integer)
    field(:participants, list_of(:common_user))
    field(:is_viewer_joined, :boolean)
  end

  ####### reports
  object :abuse_report_case do
    field(:reason, :string)
    field(:attr, :string)
    field(:user, :common_user)
  end

  object :abuse_report do
    field(:id, :id)
    field(:article, :common_article)
    field(:comment, :common_comment)
    field(:account, :common_user)
    field(:report_cases_count, :integer)
    field(:deal_with, :string)
    field(:operate_user, :user)
    field(:report_cases, list_of(:abuse_report_case))

    timestamp_fields()
  end

  object :artiment_mention do
    field(:id, :id)
    field(:mentioner_type, :mention_type)
    field(:mentioner_id, :id)
    field(:mentioner_community_id, :id)
    field(:mentioner_url, :string)

    field(:mentioned_scope, :mention_scope)
    field(:mentioned_type, :mention_type)
    field(:mentioned_id, :id)
    field(:mentioned_community_id, :id)
    field(:mentioned_url, :string)
    field(:mentioned_url_hash, :string)

    field(:mention_case, :mention_case)
    field(:occurrences, list_of(:json))
    field(:mentioner_snapshot, :json)
    field(:mentioned_snapshot, :json)
    field(:meta, :json)
    field(:mentioned_at, :datetime)

    timestamp_fields()
  end

  object :blog_feed do
    field(:title, :string)
    field(:digest, :string)
    field(:link_addr, :string)
    field(:content, :string)
    field(:published, :string)
    field(:updated, :string)
  end

  object :blog_author do
    field(:name, :string)
    field(:intro, :string)
    field(:github, :string)
    field(:twitter, :string)
  end

  paged_article_objects()

  object :kanban_posts do
    field(:backlog, :paged_posts)
    field(:todo, :paged_posts)
    field(:wip, :paged_posts)
    field(:done, :paged_posts)
    field(:rejected, :paged_posts)
  end

  object :paged_reports do
    field(:entries, list_of(:abuse_report))
    pagination_fields()
  end

  object :paged_mentions do
    field(:entries, list_of(:artiment_mention))
    pagination_fields()
  end

  object :paged_categories do
    field(:entries, list_of(:category))
    pagination_fields()
  end

  object :paged_comments do
    field(:entries, list_of(:comment))
    pagination_fields()
  end

  object :paged_comment_replies do
    field(:entries, list_of(:comment_reply))
    pagination_fields()
  end

  object :paged_communities do
    field(:entries, list_of(:community))
    pagination_fields()
  end

  object :paged_articles do
    field(:entries, list_of(:common_article))
    pagination_fields()
  end

  @desc "article meta info"
  object :article_meta do
    field(:thread, :thread)
    field(:is_edited, :boolean)
    field(:is_comment_locked, :boolean)
    field(:last_active_at, :datetime)
    field(:latest_upvoted_users, list_of(:common_user))
    # audit states
    field(:is_legal, :boolean)
    field(:illegal_reason, list_of(:string))
    field(:illegal_words, list_of(:string))
  end

  object :community_meta do
    threads_count_fields()
    field(:apply_msg, :string)
    field(:apply_category, :string)
  end

  object :open_graph do
    field(:title, :string)
    field(:url, :string)
    field(:favicon, :string)
    field(:site_name, :string)
  end

  object :client_locale do
    field(:locale, :string)
  end

  defp cover_background_loader(field, config, args, _resolution) do
    # CoverConfig is an embedded schema, so there is no Ecto association for
    # Absinthe to preload. Use the stored background id as the Dataloader item
    # key so light/dark cover backgrounds still batch through the CMS loader.
    %{batch: {CoverBackground, args}, item: Map.get(config, field)}
  end
end
