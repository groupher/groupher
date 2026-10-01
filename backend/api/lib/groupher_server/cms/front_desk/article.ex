defmodule GroupherServer.CMS.FrontDesk.Article do
  @moduledoc """
  Resolves public Article paths through typed Gate Scope and Article projection.

  Business position:

      CMS.FrontDesk facade
        -> FrontDesk.Article
        -> Gate Scope / Repo
        -> Articles.Response
  """

  import Ecto.Query, warn: false

  require GroupherServer.CMS.Docs.Const

  alias GroupherServer.{CMS, Repo}

  alias CMS.Articles.ErrorCat, as: ArticleErrorCat
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
  @spec read(ArticlePath.t(), term(), keyword()) :: {:ok, struct()} | {:error, map()}
  def read(article_path, actor, opts) do
    with {:ok, %{community: community, thread: thread, inner_id: inner_id}} <-
           ArticlePath.parse(article_path),
         {:ok, community} <- CommunityReader.read(community) do
      with {:ok, _thread} <- Enable.thread?(community.slug, thread) do
        read_stable(community, thread, inner_id, actor, opts)
      end
    end
  end

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

  defp build_stable_projection(article, community, public, revision, branch_id) do
    body = Repo.get!(ArticleBodySnapshot, revision.body_snapshot_id)
    tags = stable_community_tags(article.id, community.id)
    lifecycle = stable_lifecycle(article, branch_id)

    projection =
      %{
        id: article.id,
        article_id: article.id,
        branch_id: branch_id,
        inner_id: article.inner_id,
        thread: article.thread,
        stage: :public,
        title: public.title,
        digest: public.digest,
        slug: public.slug,
        body_hash: public.body_hash,
        document: body,
        author_id: article.author_id,
        author: article.author.user,
        community: community,
        communities: [community],
        community_id: community.id,
        community_tags: tags,
        comments_participants: stable_comment_participants(article.id),
        moderation_state: article.moderation_state,
        active_at: article.active_at || Map.get(public, :active_at),
        inserted_at: public.published_at,
        updated_at: public.updated_at,
        revision_id: revision.id,
        publication_version: public.publication_version,
        version: public.publication_version,
        lifecycle: lifecycle,
        is_pinned: stable_pinned?(article.id, community.id),
        pending: 0,
        viewer_has_collected: false,
        viewer_has_upvoted: false,
        viewer_has_reported: false,
        viewer_has_viewed: false,
        meta: stable_meta(article, branch_id)
      }
      |> Map.merge(stable_revision_extension(article.thread, revision.id))
      |> Map.merge(stable_operational_extension(article))

    {:ok, projection}
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
    state = Repo.get_by!(DocBranchState, article_id: article.id, branch_id: branch_id)

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

  @doc "Reads visible public Articles for a bounded set of structured paths."
  @spec read_paths([ArticlePath.t()]) :: {:ok, [%{path: map(), article: struct()}]}
  def read_paths(paths) when is_list(paths) do
    parsed =
      paths
      |> Enum.reduce([], fn path, acc ->
        case ArticlePath.parse(path) do
          {:ok, normalized} -> [normalized | acc]
          {:error, _} -> acc
        end
      end)
      |> Enum.reverse()

    resolved_by_path =
      parsed
      |> Enum.group_by(&{&1.community, &1.thread})
      |> Enum.reduce(%{}, fn {{community_ref, thread}, group}, acc ->
        with {:ok, community} <- CommunityReader.read(community_ref),
             {:ok, _thread} <- Enable.thread?(community.slug, thread) do
          inner_ids = Enum.map(group, &normalize_path_inner_id(&1.inner_id))

          community.id
          |> public_articles(thread, inner_ids)
          |> Enum.reduce(acc, fn article, group_acc ->
            Map.put(group_acc, {community_ref, thread, article.inner_id}, article)
          end)
        else
          _ -> acc
        end
      end)

    {:ok,
     Enum.flat_map(parsed, fn path ->
       case Map.get(resolved_by_path, {
              path.community,
              path.thread,
              normalize_path_inner_id(path.inner_id)
            }) do
         nil -> []
         article -> [%{path: path, article: article}]
       end
     end)}
  end

  defp normalize_path_inner_id(inner_id) when is_integer(inner_id), do: inner_id

  defp normalize_path_inner_id(inner_id) do
    case Integer.parse(to_string(inner_id)) do
      {value, ""} -> value
      _ -> -1
    end
  end

  defp public_articles(community_id, :doc, inner_ids) do
    from(article in Article,
      join: relation in ArticleCommunity,
      on: relation.article_id == article.id,
      join: branch in CMS.Model.DocBranch,
      on: branch.community_id == article.community_id and branch.type == :main,
      join: lifecycle in DocLifecycle,
      on: lifecycle.article_id == article.id and lifecycle.branch_id == branch.id,
      join: state in DocBranchState,
      on: state.article_id == article.id and state.branch_id == branch.id,
      join: public in DocPublic,
      on: public.article_id == article.id and public.branch_id == branch.id,
      where:
        relation.community_id == ^community_id and relation.visible == true and
          article.thread == :doc and article.inner_id in ^inner_ids and
          lifecycle.state in [:published, :archived] and state.moderation_state == :legal and
          public.visible == true,
      select: %{article: article, branch_id: branch.id}
    )
    |> Repo.all()
    |> Enum.map(&Map.put(&1.article, :branch_id, &1.branch_id))
  end

  defp public_articles(community_id, thread, inner_ids) do
    from(article in Article,
      join: relation in ArticleCommunity,
      on: relation.article_id == article.id,
      join: lifecycle in ArticleLifecycle,
      on: lifecycle.article_id == article.id,
      join: public in ArticlePublic,
      on: public.article_id == article.id,
      where:
        relation.community_id == ^community_id and relation.visible == true and
          article.thread == ^thread and article.inner_id in ^inner_ids and
          lifecycle.state in [:published, :archived] and article.moderation_state == :legal and
          public.visible == true,
      select: article
    )
    |> Repo.all()
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

  @doc "Reads one public ArticleStats batch without loading Articles one by one."
  @spec read_article_stats(String.t(), atom(), [String.t() | integer()]) ::
          {:ok, [map()]} | {:error, map()}
  def read_article_stats(community_ref, thread, inner_ids)
      when is_binary(community_ref) and is_atom(thread) and is_list(inner_ids) do
    with {:ok, inner_ids} <- normalize_inner_ids(inner_ids),
         {:ok, stats} <- read_article_stats_batch(community_ref, thread, inner_ids) do
      {:ok, stats}
    else
      {:error, _} = error -> error
    end
  end

  defp read_article_stats_batch(_community_ref, _thread, []), do: {:ok, []}

  defp read_article_stats_batch(community_ref, thread, inner_ids) do
    with {:ok, %Community{id: community_id}} <- CommunityReader.read(community_ref) do
      rows =
        Article
        |> join(:inner, [article], relation in ArticleCommunity,
          on: relation.article_id == article.id and relation.visible == true
        )
        |> where(
          [article, relation],
          article.thread == ^thread and relation.community_id == ^community_id and
            article.inner_id in ^inner_ids
        )
        |> select([article, _relation], article)
        |> Repo.all()

      articles = rows
      stats_by_article_id = CMS.ArticleStats.for_articles(thread, articles)

      with :ok <- ensure_stats_rows(articles, stats_by_article_id, thread) do
        stats_by_inner_id =
          Map.new(articles, fn article ->
            stats = Map.fetch!(stats_by_article_id, {thread, article.id})

            {to_string(article.inner_id),
             Map.merge(stats, %{
               community: community_ref,
               thread: thread,
               inner_id: article.inner_id
             })}
          end)

        {:ok,
         Enum.flat_map(inner_ids, fn inner_id ->
           case Map.fetch(stats_by_inner_id, to_string(inner_id)) do
             {:ok, stats} -> [stats]
             :error -> []
           end
         end)}
      end
    else
      {:error, _} = error -> error
    end
  end

  defp normalize_inner_ids(inner_ids) do
    normalized =
      Enum.reduce_while(inner_ids, {:ok, []}, fn value, {:ok, acc} ->
        case Integer.parse(to_string(value)) do
          {id, ""} when id > 0 -> {:cont, {:ok, [id | acc]}}
          _ -> {:halt, :error}
        end
      end)

    case normalized do
      {:ok, ids} ->
        ids = ids |> Enum.uniq() |> Enum.reverse()

        if length(ids) <= 100,
          do: {:ok, ids},
          else: {:error, ArticleErrorCat.article_not_found("too many article ids")}

      :error ->
        {:error, ArticleErrorCat.article_not_found("invalid article ids")}
    end
  end

  @doc "Builds ArticleStats for canonical Articles already loaded by a management scope."
  @spec stats_for_articles(atom(), [struct()], String.t() | nil) ::
          %{optional({atom(), integer()}) => map()} | {:error, term()}
  def stats_for_articles(thread, articles, community_ref \\ nil)
      when is_atom(thread) and is_list(articles) do
    articles = preload_stats_communities(articles, community_ref)

    stats_by_article_id = CMS.ArticleStats.for_articles(thread, articles)

    with :ok <- ensure_stats_rows(articles, stats_by_article_id, thread) do
      Map.new(articles, fn article ->
        stats = Map.fetch!(stats_by_article_id, {thread, article.id})
        community = community_ref || article_community_slug(article)

        {{thread, article.id}, Map.put(stats, :community, community)}
      end)
    end
  end

  defp ensure_stats_rows(articles, stats_by_article_id, thread) do
    if Enum.all?(articles, &Map.has_key?(stats_by_article_id, {thread, &1.id})) do
      :ok
    else
      {:error, ArticleErrorCat.projection_not_updated()}
    end
  end

  defp article_community_slug(%{community: %Ecto.Association.NotLoaded{}}), do: nil
  defp article_community_slug(%{community: %{slug: slug}}), do: slug
  defp article_community_slug(_article), do: nil

  defp preload_stats_communities(articles, community_ref) when is_binary(community_ref),
    do: articles

  defp preload_stats_communities(articles, _community_ref), do: Repo.preload(articles, :community)
end
