defmodule GroupherServer.CMS.FrontDesk do
  @moduledoc """
  Stable CMS facade for single-resource reads and relationship lookup.

  `:public` is the default read mode. `:management` requires an actor and
  delegates actor/resource policy to Gate. `:internal` is reserved for trusted
  backend command, event, and recovery reads. Batch projections and writes stay
  in their owning domain facades.

  Business position:

      GraphQL resolver / job / CMS domain
        -> CMS.FrontDesk facade
        -> Article / Comment / Community / Relation
  """

  alias GroupherServer.CMS

  alias CMS.FrontDesk.{
    Article,
    Community,
    Relation
  }

  alias CMS.FrontDesk.Comment, as: CommentReader

  alias CMS.Helper.ArticlePath
  alias CMS.Model.CommunityTag
  alias Helper.T

  @doc "Reads one Community by id or public slug in the default public mode."
  def community(ref), do: Community.read(ref)

  @doc "Reads one Community with an explicit mode and optional named view."
  def community(ref, opts) when is_list(opts), do: Community.read(ref, nil, opts)
  def community(ref, actor, opts), do: Community.read(ref, actor, opts)

  @doc "Reads one Comment from a structured public path in the default public mode."
  def comment(comment_path) when is_map(comment_path), do: CommentReader.read(comment_path)
  def comment(_comment_id), do: {:error, CMS.Comments.ErrorCat.not_exist("comment path required")}

  @doc "Reads one Comment with an explicit mode/view or Article path and inner id."
  def comment(comment_path_or_id, opts) when is_list(opts),
    do: CommentReader.read(comment_path_or_id, opts)

  def comment(comment_path, actor) when is_map(comment_path) and is_map(actor),
    do: CommentReader.read(comment_path, actor, [])

  def comment(article_path, inner_id), do: CommentReader.read(article_path, inner_id, nil, [])

  def comment(article_path, inner_id, opts)
      when is_map(article_path) and (is_integer(inner_id) or is_binary(inner_id)) and
             is_list(opts),
    do: CommentReader.read(article_path, inner_id, nil, opts)

  def comment(comment_path, actor, opts) when is_map(comment_path) and is_map(actor),
    do: CommentReader.read(comment_path, actor, opts)

  @doc "Reads one Community Tag by database id."
  @spec community_tag(T.id()) :: T.domain_res(CommunityTag.t())
  def community_tag(id), do: Community.tag(id)

  @doc "Reads one Community Tag Group by database id."
  def community_tag_group(id), do: Community.tag_group(id)

  @doc "Reads one Community Tag by public coordinates."
  def community_tag(community, thread, slug), do: Community.tag(community, thread, slug)

  @doc "Returns the author of an Article or Comment."
  def article_author(resource), do: Relation.author_of(resource)

  @doc "Returns the parent Article of a Comment."
  def article_of(comment), do: Relation.article_of(comment)

  @doc "Returns the canonical thread of a Comment or Article projection."
  def thread_of(resource), do: Relation.thread_of(resource)

  @doc "Reads one Article from a path or internal id with an explicit mode/view."
  @spec article(ArticlePath.t() | Ecto.UUID.t()) :: {:ok, struct()} | {:error, map()}
  def article(article_ref), do: Article.read(article_ref, nil, [])

  @spec article(ArticlePath.t() | Ecto.UUID.t(), keyword()) ::
          {:ok, struct()} | {:error, map()}
  def article(article_ref, opts) when is_list(opts), do: Article.read(article_ref, nil, opts)

  @spec article(ArticlePath.t(), term()) :: {:ok, struct()} | {:error, map()}
  def article(article_path, actor), do: Article.read(article_path, actor, [])

  @spec article(ArticlePath.t(), term(), keyword()) :: {:ok, struct()} | {:error, map()}
  def article(article_path, actor, opts), do: Article.read(article_path, actor, opts)

  @doc "Loads one public canonical Article for an explicit ViewTracker request."
  def article_for_view_tracking(article_path), do: Article.read_for_view_tracking(article_path)

  @doc "Locks and revalidates one physical Article inside the ViewTracker transaction."
  def lock_article_for_view_tracking(article), do: Article.lock_for_view_tracking(article)

  @doc "Reads one Article through the actor-aware Article Insights scope."
  def article_insights(article_path, actor, opts \\ []),
    do: Article.read_insights(article_path, actor, opts)
end
