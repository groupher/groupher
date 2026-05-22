defmodule GroupherServerWeb.Schema.CMS.Types do
  @moduledoc """
  cms types used in queries & mutations
  """
  use Helper.GqlSchemaSuite

  import GroupherServerWeb.Schema.Helper.Fields
  import GroupherServerWeb.Schema.Helper.Objects

  import Ecto.Query, warn: false
  import Absinthe.Resolution.Helpers, only: [dataloader: 2]

  alias GroupherServer.{Accounts, CMS}
  alias CMS.Helper.ThemePreset
  alias CMS.Model.Community
  alias Helper.ORM
  alias GroupherServerWeb.Schema

  import_types(Schema.CMS.Metrics)

  object :check_state do
    field(:exist, :boolean)
  end

  object :done_state do
    field(:done, :boolean)
  end

  object :dsb_theme_preset_option do
    field(:value, :dsb_theme_preset)
    field(:tokens, :json)
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
    field(:rss, :string)
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
  object(:dsb_wallpaper, do: dsb_gq_fields(:wallpaper))

  object :dsb_layout do
    dsb_gq_fields(:layout, except: [:theme_overwrite])

    field :theme_tokens, :json do
      resolve(fn layout, _, _ ->
        tokens =
          case layout.theme_preset do
            :custom ->
              ThemePreset.resolve_custom(layout.theme_preset_base, layout.theme_overwrite)

            preset ->
              ThemePreset.resolve(preset, layout.theme_overwrite)
          end

        {:ok, tokens}
      end)
    end

    field :has_custom_theme_preset, :boolean do
      resolve(fn layout, _, _ ->
        {:ok, map_size(layout.theme_overwrite || %{}) > 0}
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
  object(:dsb_faq_section, do: dsb_gq_fields(:faq_section))

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
    field(:faqs, list_of(:dsb_faq_section))
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
    field(:id, :id)
    field(:title, :string)
    field(:desc, :string)
    field(:slug, :string)
    field(:favicon, :string)
    field(:homepage, :string)
    field(:index, :integer)
    field(:logo, :string)
    field(:author, :user, resolve: dataloader(CMS, :author))
    field(:locale, :string)
    field(:categories, list_of(:category), resolve: dataloader(CMS, :categories))
    field(:dashboard, :dsb, resolve: dataloader(CMS, :dashboard))

    # field(:moderators, list_of(:community_moderator), resolve: dataloader(CMS, moderators: :user))
    field(:moderators, list_of(:community_moderator))

    field(:meta, :community_meta)
    field(:views, :integer)
    field(:contributes_digest, list_of(:integer))

    field(:articles_count, :integer)
    field(:subscribers_count, :integer)
    field(:moderators_count, :integer)

    field :community_tags_count, :integer do
      resolve(&R.CMS.community_tags_count/3)
    end

    field(:viewer_has_subscribed, :boolean)
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
    field(:icon, :string)
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

  object :citing do
    field(:id, :id)
    field(:thread, :thread)
    field(:title, :string)
    field(:block_linker, list_of(:string))
    field(:comment_id, :id)
    field(:user, :common_user)

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

  object :paged_citings do
    field(:entries, list_of(:citing))
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
    field(:citing_count, :integer)
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
end
