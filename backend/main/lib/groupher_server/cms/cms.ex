defmodule GroupherServer.CMS do
  @moduledoc """
  this module defined basic method to handle [CMS] content [CRUD] ..
  [CMS]: post, job, ...
  [CRUD]: create, update, delete ...
  """
  alias GroupherServer.CMS.Delegate

  alias Delegate.{
    AbuseReport,
    ArticleCRUD,
    ArticleCommunity,
    ArticleEmotion,
    CitedArtiment,
    CommentCRUD,
    ArticleCollect,
    ArticleUpvote,
    CommentAction,
    CommentEmotion,
    ArticleTag,
    CommunityCRUD,
    CommunityOperation,
    PassportCRUD,
    Search,
    Seeds,
    ThirdPart
  }

  # do not pattern match in delegating func, do it on one delegating inside
  # see https://github.com/elixir-lang/elixir/issues/5306

  # Community CRUD: moderators, thread, tag
  defdelegate read_community(args), to: CommunityCRUD
  defdelegate read_community(args, opt), to: CommunityCRUD
  defdelegate read_community(args, user, opt), to: CommunityCRUD

  defdelegate paged_communities(filter, user), to: CommunityCRUD
  defdelegate paged_communities(filter), to: CommunityCRUD
  defdelegate create_community(args, user), to: CommunityCRUD
  defdelegate delete_community(community), to: CommunityCRUD
  defdelegate apply_community(args, user), to: CommunityCRUD
  defdelegate update_community(community, args), to: CommunityCRUD
  defdelegate update_dashboard(community, key, args), to: CommunityCRUD
  defdelegate approve_community_apply(community), to: CommunityCRUD
  defdelegate deny_community_apply(id), to: CommunityCRUD
  defdelegate community_exist?(slug), to: CommunityCRUD
  defdelegate has_pending_community_apply?(user), to: CommunityCRUD

  # TODO: delete after prod seed
  defdelegate update_community_count_field(community, user_id, type, opt), to: CommunityCRUD
  defdelegate update_community_count_field(community, thread), to: CommunityCRUD

  # >> geo info ..
  defdelegate community_geo_info(community), to: CommunityCRUD
  # >> subscribers
  defdelegate community_members(type, community, filters), to: CommunityCRUD
  defdelegate community_members(type, community, filters, user), to: CommunityCRUD
  # >> category
  defdelegate create_category(category_attrs, user), to: CommunityCRUD
  defdelegate update_category(category_attrs), to: CommunityCRUD
  # >> thread
  defdelegate create_thread(attrs), to: CommunityCRUD
  defdelegate count(community, part), to: CommunityCRUD
  # >> tag
  defdelegate create_article_tag(community, thread, attrs, user), to: ArticleTag
  defdelegate update_article_tag(tag_id, attrs), to: ArticleTag
  defdelegate delete_article_tag(tag_id), to: ArticleTag
  defdelegate set_article_tag(thread, article_id, tag_id), to: ArticleTag
  defdelegate unset_article_tag(thread, article_id, tag_id), to: ArticleTag
  defdelegate paged_article_tags(filter), to: ArticleTag
  defdelegate reindex_tags_in_group(community, thread, group, tags), to: ArticleTag

  # CommunityOperation
  # >> category
  defdelegate set_category(community, category), to: CommunityOperation
  defdelegate unset_category(community, category), to: CommunityOperation
  # >> moderator
  defdelegate add_moderator(community, role, target_user, cur_user), to: CommunityOperation
  defdelegate remove_moderator(community, user, cur_user), to: CommunityOperation
  defdelegate update_moderator_passport(community, role, user, cur_user), to: CommunityOperation

  # >> thread
  defdelegate set_thread(community, thread), to: CommunityOperation
  defdelegate unset_thread(community, thread), to: CommunityOperation
  # >> subscribe / unsubscribe
  defdelegate subscribe_community(community, user), to: CommunityOperation
  defdelegate subscribe_community(community, user, remote_ip), to: CommunityOperation
  defdelegate unsubscribe_community(community, user), to: CommunityOperation
  defdelegate unsubscribe_community(community, user, remote_ip), to: CommunityOperation

  defdelegate subscribe_default_community_ifnot(user, remote_ip), to: CommunityOperation
  defdelegate subscribe_default_community_ifnot(user), to: CommunityOperation

  # ArticleCRUD
  defdelegate read_article(community_slug, thread, id), to: ArticleCRUD
  defdelegate read_article(community_slug, thread, id, user), to: ArticleCRUD

  defdelegate set_article_illegal(thread, id, attrs), to: ArticleCRUD
  defdelegate set_article_illegal(article, attrs), to: ArticleCRUD
  defdelegate unset_article_illegal(thread, id, attrs), to: ArticleCRUD
  defdelegate unset_article_illegal(article, attrs), to: ArticleCRUD
  defdelegate set_article_audit_failed(article, state), to: ArticleCRUD

  defdelegate paged_articles(thread, filter), to: ArticleCRUD
  defdelegate paged_articles(thread, filter, user), to: ArticleCRUD
  defdelegate grouped_kanban_posts(community), to: ArticleCRUD
  defdelegate paged_kanban_posts(community_slug, filter), to: ArticleCRUD

  defdelegate paged_published_articles(thread, filter, user), to: ArticleCRUD
  defdelegate paged_audit_failed_articles(thread, filter), to: ArticleCRUD

  defdelegate create_article(community, thread, attrs, user), to: ArticleCRUD
  defdelegate update_article(article, attrs), to: ArticleCRUD

  defdelegate mark_delete_article(thread, id), to: ArticleCRUD
  defdelegate undo_mark_delete_article(thread, id), to: ArticleCRUD
  defdelegate delete_article(article), to: ArticleCRUD
  defdelegate delete_article(article, reason), to: ArticleCRUD

  defdelegate set_post_cat(post, cat), to: ArticleCRUD
  defdelegate set_post_state(post, state), to: ArticleCRUD

  defdelegate update_active_timestamp(thread, article), to: ArticleCRUD
  defdelegate sink_article(thread, id), to: ArticleCRUD
  defdelegate undo_sink_article(thread, id), to: ArticleCRUD

  defdelegate archive_articles(thread), to: ArticleCRUD
  defdelegate batch_mark_delete_articles(community, thread, id_list), to: ArticleCRUD
  defdelegate batch_undo_mark_delete_articles(community, thread, id_list), to: ArticleCRUD

  defdelegate paged_citing_contents(type, id, filter), to: CitedArtiment

  defdelegate upvote_article(thread, article_id, user), to: ArticleUpvote
  defdelegate undo_upvote_article(thread, article_id, user), to: ArticleUpvote

  defdelegate upvoted_users(thread, article_id, filter), to: ArticleUpvote

  defdelegate collect_article(thread, article_id, user), to: ArticleCollect
  defdelegate collect_article_ifneed(thread, article_id, user), to: ArticleCollect

  defdelegate undo_collect_article(thread, article_id, user), to: ArticleCollect
  defdelegate undo_collect_article_ifneed(thread, article_id, user), to: ArticleCollect
  defdelegate collected_users(thread, article_id, filter), to: ArticleCollect

  defdelegate set_collect_folder(collect, folder), to: ArticleCollect
  defdelegate undo_set_collect_folder(collect, folder), to: ArticleCollect

  # ArticleCommunity
  # >> set flag on article, like: pin / unpin article
  defdelegate pin_article(community, article), to: ArticleCommunity
  defdelegate undo_pin_article(community, article), to: ArticleCommunity

  # >> community: set / unset
  defdelegate mirror_article(target_community, article), to: ArticleCommunity
  defdelegate mirror_article(target_community, article, article_ids), to: ArticleCommunity
  defdelegate unmirror_article(target_community, article), to: ArticleCommunity
  defdelegate move_article(target_community, article), to: ArticleCommunity
  defdelegate move_article(target_community, article, article_ids), to: ArticleCommunity

  defdelegate move_to_blackhole(target_community, article, article_ids), to: ArticleCommunity
  defdelegate move_to_blackhole(target_community, article), to: ArticleCommunity

  defdelegate mirror_to_home(target_community, article), to: ArticleCommunity
  defdelegate mirror_to_home(target_community, article, article_ids), to: ArticleCommunity

  defdelegate emotion_to_article(thread, article_id, args, user), to: ArticleEmotion
  defdelegate undo_emotion_to_article(thread, article_id, args, user), to: ArticleEmotion

  # Comment CRUD

  defdelegate set_comment_illegal(comment_id, attrs), to: CommentCRUD
  defdelegate unset_comment_illegal(comment_id, attrs), to: CommentCRUD
  defdelegate paged_audit_failed_comments(filter), to: CommentCRUD

  defdelegate set_comment_audit_failed(comment, state), to: CommentCRUD

  defdelegate comments_state(thread, article_id), to: CommentCRUD
  defdelegate comments_state(thread, article_id, user), to: CommentCRUD
  defdelegate one_comment(id), to: CommentCRUD
  defdelegate one_comment(id, user), to: CommentCRUD

  defdelegate update_user_in_comments_participants(user), to: CommentCRUD
  defdelegate paged_comments(thread, article_id, filters, mode), to: CommentCRUD
  defdelegate paged_comments(thread, article_id, filters, mode, user), to: CommentCRUD

  defdelegate paged_published_comments(user, thread, filters), to: CommentCRUD
  defdelegate paged_published_comments(user, filters), to: CommentCRUD

  defdelegate paged_folded_comments(thread, article_id, filters), to: CommentCRUD
  defdelegate paged_folded_comments(thread, article_id, filters, user), to: CommentCRUD

  defdelegate paged_comment_replies(comment_id, filters), to: CommentCRUD
  defdelegate paged_comment_replies(comment_id, filters, user), to: CommentCRUD
  defdelegate paged_comments_participants(thread, content_id, filters), to: CommentCRUD
  defdelegate create_comment(community, thread, inner_id, args, user), to: CommentCRUD

  defdelegate update_comment(comment, content), to: CommentCRUD
  defdelegate delete_comment(comment), to: CommentCRUD
  defdelegate mark_comment_solution(comment, user), to: CommentCRUD
  defdelegate undo_mark_comment_solution(comment, user), to: CommentCRUD

  defdelegate archive_comments(), to: CommentCRUD

  defdelegate upvote_comment(comment_id, user), to: CommentAction
  defdelegate undo_upvote_comment(comment_id, user), to: CommentAction
  defdelegate reply_comment(comment_id, args, user), to: CommentAction
  defdelegate lock_article_comments(thread, article_id), to: CommentAction
  defdelegate undo_lock_article_comments(thread, article_id), to: CommentAction

  defdelegate pin_comment(comment_id), to: CommentAction
  defdelegate undo_pin_comment(comment_id), to: CommentAction

  defdelegate fold_comment(comment_id, user), to: CommentAction
  defdelegate unfold_comment(comment_id, user), to: CommentAction

  defdelegate emotion_to_comment(comment_id, args, user), to: CommentEmotion
  defdelegate undo_emotion_to_comment(comment_id, args, user), to: CommentEmotion
  ###################
  ###################
  ###################
  ###################

  # TODO: move report to abuse report module
  defdelegate report_article(thread, article_id, reason, attr, user), to: AbuseReport
  defdelegate report_comment(comment_id, reason, attr, user), to: AbuseReport
  defdelegate report_account(account_id, reason, attr, user), to: AbuseReport
  defdelegate undo_report_account(account_id, user), to: AbuseReport
  defdelegate undo_report_article(thread, article_id, user), to: AbuseReport
  defdelegate paged_reports(filter), to: AbuseReport
  defdelegate undo_report_comment(comment_id, user), to: AbuseReport

  # Passport CRUD
  defdelegate stamp_passport(rules, user), to: PassportCRUD
  defdelegate erase_passport(rules, user), to: PassportCRUD
  defdelegate get_passport(user), to: PassportCRUD
  defdelegate paged_passports(community, key), to: PassportCRUD
  defdelegate all_passport_rules(), to: PassportCRUD
  defdelegate delete_passport(user), to: PassportCRUD

  # search
  defdelegate search_articles(thread, args), to: Search
  defdelegate search_communities(filter), to: Search
  defdelegate search_communities(filter, user), to: Search
  defdelegate search_communities(filter, category), to: Search
  defdelegate search_communities(filter, category, user), to: Search

  # seeds
  defdelegate seed_communities(opt), to: Seeds
  defdelegate seed_community(slug, type), to: Seeds
  defdelegate seed_community(slug), to: Seeds
  defdelegate seed_set_category(communities, category), to: Seeds
  defdelegate seed_articles(community, type), to: Seeds
  defdelegate seed_articles(community, type, count), to: Seeds

  defdelegate clean_up_community(slug), to: Seeds
  defdelegate clean_up_articles(community, type), to: Seeds

  # defdelegate seed_bot, to: Seeds
  defdelegate upload_tokens(), to: ThirdPart
end
