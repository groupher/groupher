defmodule GroupherServer.CMS.FrontDesk do
  @moduledoc """
  Stable CMS facade for public reads, relationship lookup, and reply projection sync.

  Business position:

      GraphQL resolver / job / CMS domain
        -> CMS.FrontDesk facade
        -> Article / Comment / Community / Lookup / Relation / ReactionUsers
  """

  alias GroupherServer.CMS

  alias CMS.Comments.Replies

  alias CMS.FrontDesk.{
    Article,
    Community,
    Lookup,
    ReactionUsers,
    Relation
  }

  alias CMS.FrontDesk.Comment, as: CommentReader

  alias CMS.Helper.ArticlePath
  alias CMS.Model.{Comment, CommunityTag}
  alias GroupherServer.FrontDesk, as: RootFrontDesk
  alias Helper.T

  @doc "Reads one public Community by slug or alias."
  def community(slug), do: Community.read(slug)

  @doc "Reads one live User through the root FrontDesk boundary."
  def live_user(login, opts \\ []), do: RootFrontDesk.live_user(login, opts)

  @doc "Revalidates one User through the root FrontDesk boundary."
  def revalidate_user(login), do: RootFrontDesk.revalidate().user(login)

  @doc "Reads one Comment from a path or database id."
  def comment(comment_path_or_id), do: CommentReader.read(comment_path_or_id)

  @doc "Reads one Comment from a path with preload options, or under an Article path."
  def comment(path, opts_or_inner_id)

  def comment(path, opts) when is_map(path) and is_list(opts), do: CommentReader.read(path, opts)
  def comment(article_path, inner_id), do: CommentReader.read(article_path, inner_id, [])

  @doc "Reads one Comment under an Article path with preload options."
  def comment(article_path, inner_id, opts), do: CommentReader.read(article_path, inner_id, opts)

  @doc "Reads one Community Tag by database id."
  @spec community_tag(T.id()) :: T.domain_res(CommunityTag.t())
  def community_tag(id), do: Community.tag(id)

  @doc "Reads one Community Tag by public coordinates."
  def community_tag(community, thread, slug), do: Community.tag(community, thread, slug)

  @doc "Reads Community Tags in the caller's requested order."
  def community_tags(tag_ids), do: Community.tags(tag_ids)

  @doc "Returns the parent Article and author information for one Comment."
  def full_comment(comment_id), do: CommentReader.full(comment_id)

  @doc "Finds one schema row by primary id."
  def get(queryable, id), do: Lookup.get(queryable, id)

  @doc "Finds one schema row by primary id with preloads."
  def get(queryable, id, preload: preload), do: Lookup.get(queryable, id, preload: preload)

  @doc "Finds one schema row by clauses."
  def get_by(queryable, clauses), do: Lookup.get_by(queryable, clauses)

  @doc "Finds one schema row by clauses with preloads."
  def get_by(queryable, clauses, preload: preload),
    do: Lookup.get_by(queryable, clauses, preload: preload)

  @doc "Preloads the author relation expected by Article or Comment callers."
  def preload_author(resource), do: Relation.preload_author(resource)

  @doc "Returns the author of an Article or Comment."
  def author_of(resource), do: Relation.author_of(resource)

  @doc "Returns the parent Article of a Comment."
  def article_of(comment, opts \\ []), do: Relation.article_of(comment, opts)

  @doc "Returns the canonical thread of a Comment or Article projection."
  def thread_of(resource), do: Relation.thread_of(resource)

  @doc "Synchronizes one updated reply into the root Comment's embedded reply projection."
  @spec sync_embed_replies(Comment.t()) :: {:ok, Comment.t()}
  def sync_embed_replies(comment), do: Replies.sync_embed_replies(comment)

  @doc "Loads one page of users attached to an Article reaction projection."
  def load_reaction_users(queryable, article, filter),
    do: ReactionUsers.load(queryable, article, filter)

  @doc "Reads one public Article from a structured path."
  @spec article(ArticlePath.t(), keyword()) :: {:ok, struct()} | {:error, map()}
  def article(article_path, opts \\ []), do: Article.read(article_path, opts)

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

  @doc "Reads one public Article from canonical Community/thread/id coordinates."
  def article(community, thread, inner_id, opts \\ []),
    do: Article.read(community, thread, inner_id, opts)
end
