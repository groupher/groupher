defmodule GroupherServer.CMS.FrontDesk do
  @moduledoc """
  Stable CMS facade for single-resource reads and relationship lookup.

  `:public` is the default read mode. `:management` requires an actor and
  delegates actor/resource policy to Gate. `:internal` is reserved for trusted
  backend command, event, and recovery reads. Bounded Article and Comment batch
  reads are implemented by their owning Query modules and exposed here; writes
  stay in their owning domain facades.

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

  alias CMS.FrontDesk.Comment, as: CommentFrontDesk
  alias CMS.Articles.ErrorCat, as: ArticlesErrorCat
  alias CMS.Comments.ErrorCat, as: CommentsErrorCat

  alias CMS.ArticlePath
  alias CMS.Model.CommunityTag
  alias Helper.T

  @max_batch 100

  @doc "Reads one resource status by locator, or a bounded batch by resolved identities."
  def artiment_status(community, refs) when is_list(refs) and length(refs) <= @max_batch do
    CMS.Artiment.Status.read_many(community, refs)
  end

  def artiment_status(_community, refs) when is_list(refs) do
    {:error, CMS.ErrorCat.invalid_body("invalid Artiment status batch")}
  end

  def artiment_status(community, locator) when is_map(locator) do
    CMS.Artiment.Status.read(community, locator)
  end

  @doc "Builds an Article, Doc or Ticket path from Community coordinates."
  defdelegate article_url(target), to: Article, as: :url

  @doc "Builds a link to one Comment below its parent resource path."
  defdelegate comment_url(parent, comment_inner_id), to: CommentFrontDesk, as: :url

  @doc "Reads a Comment reached through a stored Community Mention."
  defdelegate mentioned_comment(community_slug, locator, actor),
    to: CommentFrontDesk,
    as: :read_mentioned

  @doc "Reads one Community by id or public slug in the default public mode."
  def community(ref), do: Community.read(ref)

  @doc "Reads one Community with an explicit mode and optional named view."
  def community(ref, opts) when is_list(opts), do: Community.read(ref, nil, opts)

  @doc """
  Reads one Community with an actor and explicit public/management options.

  ## Examples

      CMS.FrontDesk.community(community_slug, actor, mode: :management)
  """
  @spec community(term(), term(), keyword()) :: T.domain_res(CMS.Model.Community.t())
  def community(ref, actor, opts), do: Community.read(ref, actor, opts)

  @doc "Reads one Comment path or a batch of up to 100 paths in input order."
  def comment(refs) when is_list(refs), do: comment(refs, [])
  def comment(comment_path) when is_map(comment_path), do: CommentFrontDesk.read(comment_path)
  def comment(_comment_id), do: {:error, CommentsErrorCat.not_exist("comment path required")}

  @doc "Reads a Comment with options/actor, or a bounded batch with options."
  def comment(refs, opts)
      when is_list(refs) and length(refs) <= @max_batch and is_list(opts) do
    case Keyword.get(opts, :mode, :public) do
      :public ->
        CMS.Comments.Query.Mentions.paths(refs)

      :internal ->
        found = CMS.Comments.Query.Mentions.existing(refs)
        {:ok, Enum.flat_map(refs, &List.wrap(Map.get(found, &1)))}

      _ ->
        {:error, CMS.ErrorCat.invalid_body("unsupported Comment batch mode")}
    end
  end

  def comment(refs, _opts) when is_list(refs) do
    {:error, CMS.ErrorCat.invalid_body("invalid Comment batch")}
  end

  def comment(comment_path_or_id, opts) when is_list(opts) do
    CommentFrontDesk.read(comment_path_or_id, opts)
  end

  def comment(comment_path, actor) when is_map(comment_path) and is_map(actor) do
    CommentFrontDesk.read(comment_path, actor, [])
  end

  @doc "Reads one Comment path with an actor and explicit public/management options."
  @spec comment(map(), term(), keyword()) :: T.domain_res(CMS.Model.Comment.t())
  def comment(comment_path, actor, opts) when is_map(comment_path) and is_map(actor) do
    CommentFrontDesk.read(comment_path, actor, opts)
  end

  @doc "Reads one Community Tag by database id."
  @spec community_tag(T.id()) :: T.domain_res(CommunityTag.t())
  def community_tag(id), do: Community.tag(id)

  @doc "Reads one Community Tag Group by database id."
  def community_tag_group(id), do: Community.tag_group(id)

  @doc "Reads one Community Tag by public coordinates."
  def community_tag(community, thread, slug), do: Community.tag(community, thread, slug)

  @doc "Returns the author of an Article or Comment."
  def article_author(resource), do: Relation.author_of(resource)

  @doc "Returns the parent Article through the Comment's explicit request Community context."
  def article_of(comment), do: Relation.article_of(comment)

  @doc "Returns the canonical thread of a Comment or Article projection."
  def thread_of(resource), do: Relation.thread_of(resource)

  @doc "Reads one Article or a batch of Article paths/stable IDs in input order."
  @spec article(ArticlePath.t() | String.t() | list()) :: {:ok, term()} | {:error, map()}
  def article(refs) when is_list(refs), do: article(refs, [])
  def article(article_ref), do: Article.read(article_ref, nil, [])

  @doc "Reads an Article with options/actor, or up to 100 refs with options."
  def article(refs, opts) when is_list(refs) and is_list(opts) do
    case Keyword.get(opts, :mode, :public) do
      :public ->
        CMS.Articles.Query.Locator.resolve(refs)

      :internal ->
        if length(refs) <= @max_batch do
          found = CMS.Articles.Query.Mentions.existing(refs)
          {:ok, Enum.flat_map(refs, &List.wrap(Map.get(found, &1)))}
        else
          {:error,
           ArticlesErrorCat.batch_limit_exceeded(%{limit: @max_batch, actual: length(refs)})}
        end

      _ ->
        {:error, CMS.ErrorCat.invalid_body("unsupported Article batch mode")}
    end
  end

  def article(refs, _opts) when is_list(refs) do
    {:error, CMS.ErrorCat.invalid_body("invalid Article batch")}
  end

  @spec article(ArticlePath.t() | String.t(), keyword()) ::
          {:ok, struct()} | {:error, map()}
  def article(article_ref, opts) when is_list(opts), do: Article.read(article_ref, nil, opts)

  @spec article(ArticlePath.t() | String.t(), term()) :: {:ok, struct()} | {:error, map()}
  def article(article_path, actor), do: Article.read(article_path, actor, [])

  @doc "Reads a public or management Article path with actor and explicit options."
  @spec article(ArticlePath.t(), term(), keyword()) :: {:ok, struct()} | {:error, map()}
  def article(article_path, actor, opts), do: Article.read(article_path, actor, opts)

  @doc "Resolves the canonical relationship between one Article and one Community."
  @spec resolve_binding(term(), term()) ::
          {:ok, CMS.Model.ArticleBinding.t()} | {:error, term()}
  def resolve_binding(article_ref, {:binding_id, binding_id, community_id}) do
    stable_ref =
      if is_map(article_ref) do
        Map.get(article_ref, :article_id) || Map.get(article_ref, :id)
      else
        article_ref
      end

    with {:ok, article} <- article(stable_ref, mode: :internal) do
      CMS.Articles.Bindings.get_by_id(article, binding_id, community_id)
    end
  end

  def resolve_binding(article_ref, community_ref) do
    stable_ref =
      if is_map(article_ref) do
        Map.get(article_ref, :article_id) || Map.get(article_ref, :id)
      else
        article_ref
      end

    with {:ok, article} <- article(stable_ref, mode: :internal),
         {:ok, community} <- community(community_ref, mode: :internal),
         {:ok, %{binding: binding}} <-
           CMS.Articles.Bindings.get(%{article_id: article.id}, community) do
      {:ok, binding}
    end
  end
end
