defmodule GroupherServer.CMS.Articles.RevisionProjection do
  @moduledoc """
  Builds Article projections anchored to an immutable ArticleRevision.

  Revision projection is an Articles concern, not a FrontDesk lookup. The
  public `build/4` entry point accepts already-resolved command parts and owns
  BodySnapshot loading, author preload, revision metadata, and projection
  assembly.

  Business position:

      Command confirmation
        -> RevisionProjection.build/4
        -> revision-rooted Article result
  """

  import Ecto.Query, warn: false

  require GroupherServer.CMS.Docs.Const

  alias GroupherServer.{CMS, Repo}
  alias CMS.Articles.ErrorCat, as: ArticleErrorCat
  alias CMS.Articles.ArticleResult

  alias CMS.Model.{
    Article,
    ArticleBodySnapshot,
    ArticleCommunity,
    ArticleCommunityTag,
    ArticleLifecycle,
    ArticleRevision,
    Community,
    CommunityTag,
    Comment,
    DocBranchState,
    DocLifecycle,
    DocRevision,
    KanbanState,
    PinnedArticle,
    PostState
  }

  @doc "Builds a revision projection from loaded command action parts."
  @spec build(Article.t(), Community.t(), ArticleRevision.t(), keyword()) ::
          {:ok, ArticleResult.t()} | {:error, term()}
  def build(
        %Article{} = article,
        %Community{} = community,
        %ArticleRevision{} = revision,
        opts \\ []
      )
      when is_list(opts) do
    article = Repo.preload(article, author: :user)

    if article.thread == :doc do
      revision_projection(article, community, revision, opts)
    else
      build_revision_projection(article, community, revision, opts)
    end
  end

  @doc false
  @spec build_stable(Article.t(), Community.t(), map(), ArticleRevision.t(), integer() | nil) ::
          {:ok, ArticleResult.t()} | {:error, term()}
  def build_stable(
        %Article{} = article,
        %Community{} = community,
        public,
        %ArticleRevision{} = revision,
        branch_id
      ) do
    build_stable_projection(article, community, public, revision, branch_id)
  end

  defp revision_projection(%Article{thread: :doc} = article, community, revision, opts) do
    with %CMS.Model.DocBranch{id: branch_id} <-
           Repo.get_by(CMS.Model.DocBranch,
             community_id: article.community_id,
             type: CMS.Docs.Const.doc_branch_type(:main)
           ),
         %CMS.Model.DocBranchVersion{} = version <-
           Repo.get_by(CMS.Model.DocBranchVersion,
             article_id: article.id,
             branch_id: branch_id,
             revision_id: revision.id
           ) do
      metadata =
        opts
        |> Keyword.put_new(:branch_id, branch_id)
        |> Keyword.put_new(:publication_version, version.version_number)
        |> Keyword.put_new(:published_at, version.published_at)

      build_revision_projection(article, community, revision, metadata)
    else
      _ -> {:error, ArticleErrorCat.article_not_found("article revision not found")}
    end
  end

  defp build_revision_projection(article, community, revision, opts) do
    with %ArticleBodySnapshot{} = body <- Repo.get(ArticleBodySnapshot, revision.body_snapshot_id),
         {:ok, meta} <- revision_meta(article, Keyword.get(opts, :branch_id)) do
      published_at = Keyword.get(opts, :published_at, revision.inserted_at)
      publication_version = Keyword.get(opts, :publication_version, 1)

      {:ok,
       build_article_projection(article, community, revision, body, %{
         branch_id: Keyword.get(opts, :branch_id),
         title: revision.title,
         digest: revision.digest,
         slug: revision.slug,
         body_hash: revision.content_hash,
         active_at: nil,
         inserted_at: published_at,
         updated_at: published_at,
         publication_version: publication_version,
         meta: meta
       })}
    else
      nil -> {:error, ArticleErrorCat.article_not_found("article revision body not found")}
      {:error, _reason} = error -> error
    end
  end

  defp build_stable_projection(article, community, public, revision, branch_id) do
    case Repo.get(ArticleBodySnapshot, revision.body_snapshot_id) do
      %ArticleBodySnapshot{} = body ->
        {:ok,
         build_article_projection(article, community, revision, body, %{
           branch_id: branch_id,
           title: public.title,
           digest: public.digest,
           slug: public.slug,
           body_hash: public.body_hash,
           active_at: article.active_at || Map.get(public, :active_at),
           inserted_at: public.published_at,
           updated_at: public.updated_at,
           publication_version: public.publication_version,
           meta: stable_meta(article, branch_id)
         })}

      nil ->
        {:error, ArticleErrorCat.article_not_found("article body snapshot not found")}
    end
  end

  defp build_article_projection(article, community, revision, body, anchor) do
    tags = stable_community_tags(article.id, community.id)
    lifecycle = stable_lifecycle(article, Map.get(anchor, :branch_id))

    %{
      id: article.id,
      article_id: article.id,
      branch_id: Map.get(anchor, :branch_id),
      inner_id: article.inner_id,
      thread: article.thread,
      stage: :public,
      title: Map.fetch!(anchor, :title),
      digest: Map.fetch!(anchor, :digest),
      slug: Map.fetch!(anchor, :slug),
      body_hash: Map.fetch!(anchor, :body_hash),
      document: body,
      author_id: article.author_id,
      author: article.author.user,
      community: community,
      communities: [community],
      community_id: community.id,
      community_tags: tags,
      comments_participants: stable_comment_participants(article.id),
      moderation_state: article.moderation_state,
      active_at: Map.get(anchor, :active_at),
      inserted_at: Map.fetch!(anchor, :inserted_at),
      updated_at: Map.fetch!(anchor, :updated_at),
      revision_id: revision.id,
      publication_version: Map.fetch!(anchor, :publication_version),
      version: Map.fetch!(anchor, :publication_version),
      lifecycle: lifecycle,
      is_pinned: stable_pinned?(article.id, community.id),
      pending: 0,
      viewer_has_collected: false,
      viewer_has_upvoted: false,
      viewer_has_reported: false,
      viewer_has_viewed: false,
      meta: Map.fetch!(anchor, :meta)
    }
    |> Map.merge(stable_revision_extension(article.thread, revision.id))
    |> Map.merge(stable_operational_extension(article, community.id))
    |> ArticleResult.from_map()
  end

  defp stable_comment_participants(article_id) do
    Comment
    |> where([comment], comment.article_id == ^article_id)
    |> order_by([comment], desc: comment.inserted_at, desc: comment.id)
    |> preload([comment], :author)
    |> Repo.all()
    |> Enum.map(& &1.author)
    |> Enum.uniq_by(& &1.id)
    |> Enum.take(10)
  end

  defp stable_operational_extension(%Article{thread: :post, id: article_id}, community_id) do
    cat =
      case Repo.get(PostState, article_id) do
        %PostState{cat: cat} -> cat
        nil -> nil
      end

    status =
      Repo.one(
        from(relation in ArticleCommunity,
          left_join: state in KanbanState,
          on: state.article_community_id == relation.id,
          where: relation.article_id == ^article_id and relation.community_id == ^community_id,
          select: state.status
        )
      )

    %{cat: cat, status: status}
  end

  defp stable_operational_extension(%Article{}, _community_id), do: %{}

  defp stable_meta(%Article{thread: :doc} = article, branch_id) when is_integer(branch_id) do
    case Repo.get_by(DocBranchState, article_id: article.id, branch_id: branch_id) do
      %DocBranchState{} = state ->
        %{
          thread: article.thread,
          is_edited: state.is_edited,
          is_comment_locked: state.comments_locked,
          is_sunk: state.is_sunk,
          last_active_at: state.last_active_at,
          next_floor: state.next_floor,
          next_comment_inner_id: state.next_comment_inner_id,
          is_legal: state.moderation_state == :legal,
          illegal_reason: List.wrap(state.illegal_reason),
          illegal_words: state.illegal_words
        }

      nil ->
        %{
          thread: article.thread,
          is_edited: article.is_edited,
          is_comment_locked: article.comments_locked,
          is_sunk: article.is_sunk,
          last_active_at: article.last_active_at,
          next_floor: article.next_floor,
          next_comment_inner_id: article.next_comment_inner_id,
          is_legal: article.moderation_state == :legal,
          illegal_reason: List.wrap(article.illegal_reason),
          illegal_words: article.illegal_words
        }
    end
  end

  defp stable_meta(article, _branch_id) do
    %{
      thread: article.thread,
      is_edited: article.is_edited,
      is_comment_locked: article.comments_locked,
      is_sunk: article.is_sunk,
      last_active_at: article.last_active_at,
      next_floor: article.next_floor,
      next_comment_inner_id: article.next_comment_inner_id,
      is_legal: article.moderation_state == :legal,
      illegal_reason: List.wrap(article.illegal_reason),
      illegal_words: article.illegal_words
    }
  end

  defp revision_meta(%Article{thread: :doc} = article, branch_id) when is_integer(branch_id) do
    case Repo.get_by(DocBranchState, article_id: article.id, branch_id: branch_id) do
      %DocBranchState{} = state ->
        {:ok,
         %{
           thread: article.thread,
           is_edited: state.is_edited,
           is_comment_locked: state.comments_locked,
           is_sunk: state.is_sunk,
           last_active_at: state.last_active_at,
           next_floor: state.next_floor,
           next_comment_inner_id: state.next_comment_inner_id,
           is_legal: state.moderation_state == :legal,
           illegal_reason: List.wrap(state.illegal_reason),
           illegal_words: state.illegal_words
         }}

      nil ->
        {:error, ArticleErrorCat.article_not_found("article branch state not found")}
    end
  end

  defp revision_meta(%Article{} = article, _branch_id), do: {:ok, stable_meta(article, nil)}

  defp revision_meta(_article, _branch_id) do
    {:error, ArticleErrorCat.article_not_found("article metadata not found")}
  end

  defp stable_revision_extension(:doc, revision_id) do
    revision_extension(DocRevision, revision_id)
  end

  defp stable_revision_extension(thread, revision_id) do
    model =
      case thread do
        :post -> CMS.Model.PostRevision
        :blog -> CMS.Model.BlogRevision
        :changelog -> CMS.Model.ChangelogRevision
      end

    revision_extension(model, revision_id)
  end

  defp revision_extension(model, revision_id) do
    case Repo.get(model, revision_id) do
      nil -> %{}
      extension -> extension |> Map.from_struct() |> Map.drop([:__meta__, :revision])
    end
  end

  defp stable_lifecycle(%Article{thread: :doc, id: article_id}, branch_id) do
    Repo.get_by(DocLifecycle, article_id: article_id, branch_id: branch_id)
  end

  defp stable_lifecycle(%Article{id: article_id}, _branch_id) do
    Repo.get_by(ArticleLifecycle, article_id: article_id)
  end

  defp stable_pinned?(article_id, community_id) do
    PinnedArticle
    |> join(:inner, [pin], relation in ArticleCommunity,
      on: relation.id == pin.article_community_id
    )
    |> where(
      [pin, relation],
      relation.article_id == ^article_id and relation.community_id == ^community_id
    )
    |> Repo.exists?()
  end

  defp stable_community_tags(article_id, community_id) do
    CommunityTag
    |> join(:inner, [tag], assignment in ArticleCommunityTag, on: assignment.tag_id == tag.id)
    |> join(:inner, [_tag, assignment], relation in ArticleCommunity,
      on: relation.id == assignment.article_community_id
    )
    |> where(
      [_tag, _assignment, relation],
      relation.article_id == ^article_id and relation.community_id == ^community_id
    )
    |> order_by([tag], asc: tag.id)
    |> Repo.all()
  end
end
