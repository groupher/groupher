defmodule GroupherServer.CMS do
  @moduledoc """
  this module defined basic method to handle [CMS] content [CRUD] ..
  [CMS]: post, job, ...
  [CRUD]: create, update, delete ...
  """
  alias GroupherServer.CMS.Delegate

  alias Delegate.{
    AbuseReport,
    CommentCRUD,
    CommentAction,
    CommentEmotion,
    Fetcher,
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
  defdelegate set_article_tag(article, tag_id), to: ArticleTag
  defdelegate unset_article_tag(article, tag_id), to: ArticleTag
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
  defdelegate unsubscribe_community(community, user), to: CommunityOperation
  defdelegate subscribe_default_community_ifnot(user), to: CommunityOperation

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
  defdelegate lock_article_comments(article), to: CommentAction
  defdelegate undo_lock_article_comments(article), to: CommentAction

  defdelegate pin_comment(comment_id), to: CommentAction
  defdelegate undo_pin_comment(comment_id), to: CommentAction

  defdelegate fetch_comment(comment_id), to: Fetcher
  defdelegate fetch_full_comment(comment_id), to: Fetcher

  defdelegate fold_comment(comment_id, user), to: CommentAction
  defdelegate unfold_comment(comment_id, user), to: CommentAction

  defdelegate emotion_to_comment(comment_id, args, user), to: CommentEmotion
  defdelegate undo_emotion_to_comment(comment_id, args, user), to: CommentEmotion
  ###################
  ###################
  ###################
  ###################

  # TODO: move report to abuse report module
  defdelegate report_article(article, reason, attr, user), to: AbuseReport
  defdelegate report_comment(comment, reason, attr, user), to: AbuseReport
  defdelegate report_account(account, reason, attr, user), to: AbuseReport
  defdelegate undo_report_account(account, user), to: AbuseReport
  defdelegate undo_report_article(article, user), to: AbuseReport
  defdelegate paged_reports(filter), to: AbuseReport
  defdelegate undo_report_comment(comment, user), to: AbuseReport

  # Passport CRUD
  defdelegate stamp_passport(rules, user), to: PassportCRUD
  defdelegate erase_passport(rules, user), to: PassportCRUD
  defdelegate get_passport(user), to: PassportCRUD
  defdelegate paged_passports(community, key), to: PassportCRUD
  defdelegate all_passport_rules(), to: PassportCRUD
  defdelegate delete_passport(user), to: PassportCRUD

  # search
  defdelegate search_articles(thread, args), to: Search

  def search_communities(title), do: Search.search_communities(title)

  def search_communities(title, %GroupherServer.Accounts.Model.User{} = user),
    do: Search.search_communities(title, user)

  def search_communities(title, category), do: Search.search_communities(title, category)

  def search_communities(title, category, user),
    do: Search.search_communities(title, category, user)

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
