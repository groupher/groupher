defmodule GroupherServer.CMS.FrontDesk do
  @moduledoc """
  Stable CMS facade for public reads, relationship lookup, and reply projection sync.

  Business position:

      GraphQL resolver / job / CMS domain
        -> CMS.FrontDesk facade
        -> Article / Comment / Community / Relation / ReactionUsers
  """

  alias GroupherServer.CMS

  alias CMS.Comments.Replies

  alias CMS.FrontDesk.{
    Article,
    Community,
    ReactionUsers,
    Relation
  }

  alias CMS.FrontDesk.Comment, as: CommentReader

  alias CMS.Helper.ArticlePath
  alias CMS.Model.{Comment, CommunityTag}
  alias GroupherServer.FrontDesk, as: RootFrontDesk
  alias Helper.T

  @doc "Reads one Community by id or public slug."
  def community(ref), do: Community.read(ref)

  @doc "Reads one Community with an explicit actor-aware read mode."
  def community(ref, :operations), do: Community.read(ref, :operations, mode: :operations)
  def community(ref, actor, opts), do: Community.read(ref, actor, opts)

  @doc "Revalidates one User through the root FrontDesk boundary."
  def revalidate_user(login), do: RootFrontDesk.revalidate().user(login)

  @doc "Reads one Comment from a path or database id."
  def comment(comment_path_or_id), do: CommentReader.read(comment_path_or_id)

  @doc "Reads one Comment under an Article path by inner id."
  def comment(article_path, inner_id), do: CommentReader.read(article_path, inner_id, [])

  @doc "Reads one Community Tag by database id."
  @spec community_tag(T.id()) :: T.domain_res(CommunityTag.t())
  def community_tag(id), do: Community.tag(id)

  @doc "Reads one Community Tag Group by database id."
  def community_tag_group(id), do: Community.tag_group(id)

  @doc "Reads one Community Tag by public coordinates."
  def community_tag(community, thread, slug), do: Community.tag(community, thread, slug)

  @doc "Reads Community Tags in the caller's requested order."
  def community_tags(tag_ids), do: Community.tags(tag_ids)

  @doc "Returns the parent Article and author information for one Comment."
  def full_comment(comment_id), do: CommentReader.full(comment_id)

  @doc "Returns the author of an Article or Comment."
  def article_author(resource), do: Relation.author_of(resource)

  @doc "Returns the parent Article of a Comment."
  def article_of(comment), do: Relation.article_of(comment)

  @doc "Returns the canonical thread of a Comment or Article projection."
  def thread_of(resource), do: Relation.thread_of(resource)

  @doc "Synchronizes one updated reply into the root Comment's embedded reply projection."
  @spec sync_embed_replies(Comment.t()) :: {:ok, Comment.t()}
  def sync_embed_replies(comment), do: Replies.sync_embed_replies(comment)

  @doc "Loads one page of users attached to an Article reaction projection."
  def load_reaction_users(queryable, article, filter),
    do: ReactionUsers.load(queryable, article, filter)

  @doc "Reads one public Article from its sole external locator, an ArticlePath."
  @spec article(ArticlePath.t()) :: {:ok, struct()} | {:error, map()}
  def article(article_path), do: Article.read(article_path, nil, [])

  @spec article(ArticlePath.t(), term()) :: {:ok, struct()} | {:error, map()}
  def article(article_path, actor), do: Article.read(article_path, actor, [])

  @doc "Reads visible public Articles for a bounded set of structured paths."
  def article_paths(paths), do: Article.read_paths(paths)

  @doc "Loads one public canonical Article for an explicit ViewTracker request."
  def article_for_view_tracking(article_path), do: Article.read_for_view_tracking(article_path)

  @doc "Locks and revalidates one physical Article inside the ViewTracker transaction."
  def lock_article_for_view_tracking(article), do: Article.lock_for_view_tracking(article)

  @doc "Reads public ArticleStats for one Community/thread batch."
  def article_stats(community, thread, inner_ids),
    do: Article.read_article_stats(community, thread, inner_ids)

  @doc "Builds ArticleStats for already-authorized canonical Articles."
  def article_stats_for_articles(thread, articles, community_ref \\ nil),
    do: Article.stats_for_articles(thread, articles, community_ref)

  @doc "Reads one Article through the actor-aware Article Insights scope."
  def article_insights(article_path, actor, opts \\ []),
    do: Article.read_insights(article_path, actor, opts)
end
