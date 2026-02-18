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
    Search,
    Seeds,
    ThirdPart
  }

  alias GroupherServer.CMS.Communities

  # do not pattern match in delegating func, do it on one delegating inside
  # see https://github.com/elixir-lang/elixir/issues/5306

  # Community CRUD: moderators, thread, tag
  # >> tag
  defdelegate create_community_tag(community, thread, attrs, user), to: Communities, as: :create_tag
  defdelegate update_community_tag(tag_id, attrs), to: Communities, as: :update_tag
  defdelegate delete_community_tag(tag_id), to: Communities, as: :delete_tag
  defdelegate set_community_tag(article, tag_id), to: Communities, as: :set_tag
  defdelegate unset_community_tag(article, tag_id), to: Communities, as: :unset_tag
  defdelegate paged_community_tags(filter), to: Communities, as: :paged_tags
  defdelegate reindex_community_tags(community, thread, group, tags), to: Communities, as: :reindex_tags

  # CommunityOperation


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
