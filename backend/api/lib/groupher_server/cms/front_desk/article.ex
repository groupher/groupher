defmodule GroupherServer.CMS.FrontDesk.Article do
  @moduledoc """
  Resolves public/management Article paths and trusted internal Article views.

  Business position:

      CMS.FrontDesk facade
        -> FrontDesk.Article
        -> Gate Scope or internal view
        -> Articles.Response / stable Article
  """

  import Ecto.Query, warn: false

  require GroupherServer.CMS.Docs.Const

  alias GroupherServer.{CMS, Repo}

  alias CMS.Articles.ErrorCat, as: ArticleErrorCat
  alias CMS.Articles.ArticleResult
  alias CMS.Communities.Enable
  alias CMS.FrontDesk.Community, as: CommunityReader
  alias CMS.Helper.ArticlePath

  alias CMS.Model.{
    Article,
    ArticleBodySnapshot,
    ArticleCommunity,
    ArticleCommunityTag,
    ArticleLifecycle,
    ArticlePublic,
    ArticleRevision,
    Community,
    CommunityTag,
    Comment,
    DocBranchState,
    DocLifecycle,
    DocPublic,
    DocRevision,
    PinnedArticle,
    PostState
  }

  alias Helper.ORM

  @doc "Reads one Article through the actor-aware Article Insights scope."
  @spec read_insights(ArticlePath.t(), term(), keyword()) :: {:ok, struct()} | {:error, map()}
  def read_insights(article_path, actor, opts \\ []) do
    with {:ok, projection} <- read(article_path, actor, opts),
         {:ok, _canonical} <- CMS.Gate.Access.access_check(actor, :read_insights, projection) do
      {:ok, projection}
    else
      nil -> {:error, ArticleErrorCat.article_not_found("article not found")}
      {:error, _} -> {:error, ArticleErrorCat.article_not_found("article not found")}
    end
  end

  @doc "Reads one public Article from a structured path."
  @spec read(ArticlePath.t() | String.t(), term(), keyword()) ::
          {:ok, struct()} | {:error, map()}
  def read(article_id, nil, opts) when is_binary(article_id) and is_list(opts) do
    case Keyword.get(opts, :mode, :public) do
      :internal -> read_internal(article_id, Keyword.get(opts, :view, :default))
      _ -> {:error, ArticleErrorCat.article_not_found("article not found")}
    end
  end

  def read(article_path, actor, opts) do
    case {Keyword.get(opts, :mode, :public), Keyword.get(opts, :view, :default)} do
      {mode, :default} when mode in [:public, :management] ->
        with {:ok, %{community: community, thread: thread, inner_id: inner_id}} <-
               ArticlePath.parse(article_path),
             {:ok, community} <- CommunityReader.read(community, actor, opts) do
          with {:ok, _thread} <- Enable.thread?(community.slug, thread) do
            read_stable(community, thread, inner_id, actor, opts)
          end
        end

      _mode_and_view ->
        {:error, ArticleErrorCat.article_not_found("unsupported Article read mode/view")}
    end
  end

  defp read_internal(article_id, view)
       when view in [:default, :with_community, :with_author, :command_context] do
    preload =
      case view do
        :default -> []
        :with_community -> [:community]
        :with_author -> [author: :user]
        :command_context -> [:community, author: :user]
      end

    ORM.find(Article, article_id, preload: preload)
  end

  defp read_internal(_article_id, _view),
    do: {:error, ArticleErrorCat.article_not_found("unsupported Article read view")}

  @doc "Reads a public stable Article projection from its external ArticlePath coordinates."
  @spec read_stable(Community.t(), atom(), integer() | String.t(), term(), keyword()) ::
          {:ok, map()} | {:error, term()}
  def read_stable(%Community{} = community, thread, inner_id, actor, _opts) do
    with {inner_id, ""} <- Integer.parse(to_string(inner_id)),
         %Article{} = article <- stable_article(community.id, thread, inner_id),
         :ok <- stable_article_visible(article, community.id, actor),
         {:ok, projection} <- stable_public_projection(article, community) do
      {:ok, projection}
    else
      nil -> {:error, :stable_article_not_found}
      :error -> {:error, :stable_article_not_found}
      {:error, _reason} = error -> error
    end
  end

  @doc "Reads an Article projection anchored to one immutable Revision."
  @spec read_revision(String.t(), String.t(), Community.t(), keyword()) ::
          {:ok, map()} | {:error, term()}
  def read_revision(article_id, revision_id, %Community{} = community, opts \\ [])
      when is_binary(article_id) and is_binary(revision_id) and is_list(opts) do
    with {:ok, %Article{} = article} <- read_internal(article_id, :command_context),
         %ArticleRevision{} = revision <- Repo.get(ArticleRevision, revision_id),
         true <- revision.article_id == article.id,
         {:ok, projection} <- revision_projection(article, community, revision, opts) do
      {:ok, projection}
    else
      _ -> {:error, ArticleErrorCat.article_not_found("article revision not found")}
    end
  end

  @doc "Builds a revision projection from already-loaded command action parts."
  @spec article_revision_parts(Article.t(), Community.t(), ArticleRevision.t(), keyword()) ::
          {:ok, ArticleResult.t()} | {:error, term()}
  def article_revision_parts(
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

  defp stable_article(community_id, thread, inner_id) do
    Article
    |> join(:inner, [article], relation in ArticleCommunity,
      on: relation.article_id == article.id
    )
    |> where(
      [article, relation],
      article.thread == ^thread and article.inner_id == ^inner_id and
        relation.community_id == ^community_id
    )
    |> preload([article, _relation], author: :user)
    |> Repo.one()
  end

  defp stable_article_visible(%Article{thread: :doc} = article, _community_id, actor) do
    with %CMS.Model.DocBranch{id: branch_id} <-
           Repo.get_by(CMS.Model.DocBranch,
             community_id: article.community_id,
             type: CMS.Docs.Const.doc_branch_type(:main)
           ),
         %DocLifecycle{state: state} when state in [:published, :archived] <-
           Repo.get_by(DocLifecycle, article_id: article.id, branch_id: branch_id),
         %DocBranchState{} = branch_state <-
           Repo.get_by(DocBranchState, article_id: article.id, branch_id: branch_id) do
      if branch_state.moderation_state == :legal or article_owner?(article, actor),
        do: :ok,
        else: {:error, ArticleErrorCat.pending("this article is under audition")}
    else
      _ -> {:error, ArticleErrorCat.article_not_found("article not found")}
    end
  end

  defp stable_article_visible(%Article{moderation_state: :legal} = article, community_id, _actor) do
    with true <- article_community_visible?(article.id, community_id),
         %ArticleLifecycle{state: state} when state in [:published, :archived] <-
           Repo.get_by(ArticleLifecycle, article_id: article.id) do
      :ok
    else
      _ -> {:error, ArticleErrorCat.article_not_found("article not found")}
    end
  end

  defp stable_article_visible(%Article{} = article, _community_id, actor) do
    if article_owner?(article, actor),
      do: stable_article_lifecycle_visible(article),
      else: {:error, ArticleErrorCat.pending("this article is under audition")}
  end

  defp stable_article_lifecycle_visible(article) do
    case Repo.get_by(ArticleLifecycle, article_id: article.id) do
      %ArticleLifecycle{state: state} when state in [:published, :archived] -> :ok
      _ -> {:error, ArticleErrorCat.article_not_found("article not found")}
    end
  end

  defp article_owner?(%Article{author: %{user_id: user_id}}, %{id: user_id}), do: true
  defp article_owner?(_article, _actor), do: false

  defp article_community_visible?(article_id, community_id) do
    Repo.exists?(
      from(relation in ArticleCommunity,
        where:
          relation.article_id == ^article_id and relation.community_id == ^community_id and
            relation.visible == true
      )
    )
  end

  defp stable_public_projection(%Article{thread: :doc} = article, community) do
    with %CMS.Model.DocBranch{id: branch_id} <-
           Repo.get_by(CMS.Model.DocBranch,
             community_id: article.community_id,
             type: CMS.Docs.Const.doc_branch_type(:main)
           ),
         %DocPublic{} = public <-
           Repo.get_by(DocPublic, article_id: article.id, branch_id: branch_id),
         %CMS.Model.DocBranchVersion{} = version <-
           Repo.get(CMS.Model.DocBranchVersion, public.branch_version_id),
         %ArticleRevision{} = revision <- Repo.get(ArticleRevision, version.revision_id) do
      build_stable_projection(article, community, public, revision, branch_id)
    else
      _ -> {:error, ArticleErrorCat.article_not_found("article not found")}
    end
  end

  defp stable_public_projection(%Article{} = article, community) do
    with %ArticlePublic{} = public <- Repo.get(ArticlePublic, article.id),
         %ArticleRevision{} = revision <- Repo.get(ArticleRevision, public.revision_id) do
      build_stable_projection(article, community, public, revision, nil)
    else
      _ -> {:error, ArticleErrorCat.article_not_found("article not found")}
    end
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

  defp revision_projection(%Article{} = article, community, revision, opts) do
    build_revision_projection(article, community, revision, opts)
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
    |> Map.merge(stable_operational_extension(article))
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

  defp stable_operational_extension(%Article{thread: :post, id: article_id}) do
    case Repo.get(PostState, article_id) do
      %PostState{} = state -> %{cat: state.cat, status: state.status}
      nil -> %{cat: nil, status: nil}
    end
  end

  defp stable_operational_extension(%Article{}), do: %{}

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

  defp revision_meta(_article, _branch_id),
    do: {:error, ArticleErrorCat.article_not_found("article metadata not found")}

  defp stable_revision_extension(:doc, revision_id),
    do: revision_extension(DocRevision, revision_id)

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

  defp stable_lifecycle(%Article{thread: :doc, id: article_id}, branch_id),
    do: Repo.get_by(DocLifecycle, article_id: article_id, branch_id: branch_id)

  defp stable_lifecycle(%Article{id: article_id}, _branch_id),
    do: Repo.get_by(ArticleLifecycle, article_id: article_id)

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

  @doc "Loads one public canonical Article for an explicit ViewTracker request."
  @spec read_for_view_tracking(ArticlePath.t()) :: {:ok, struct()} | {:error, map()}
  def read_for_view_tracking(article_path) do
    read(article_path, nil, [])
  end

  @doc "Locks one physical Article and revalidates its public Gate/Lifecycle scope."
  @spec lock_for_view_tracking(map()) ::
          {:ok, map(), Community.t(), DateTime.t()} | {:error, map()}
  def lock_for_view_tracking(%{id: article_id, thread: thread} = projection)
      when is_binary(article_id) and thread in [:post, :blog, :changelog, :doc] do
    received_at = DateTime.utc_now(:second)

    with %Article{} = locked <-
           Article
           |> where([article], article.id == ^article_id)
           |> lock("FOR KEY SHARE")
           |> Repo.one(),
         %Community{} = community <- Repo.get(Community, locked.community_id),
         {:ok, current} <-
           read_stable(community, thread, locked.inner_id, nil, []) do
      {:ok, Map.merge(current, Map.take(projection, [:branch_id])), community, received_at}
    else
      _ -> {:error, ArticleErrorCat.article_not_found("article not found")}
    end
  end
end
