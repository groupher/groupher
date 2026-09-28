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
  import GroupherServer.CMS.Artiment.Matcher

  alias GroupherServer.{CMS, Repo}
  alias CMS.ErrorCat

  alias CMS.Articles.ErrorCat, as: ArticleErrorCat
  alias CMS.Articles.Response
  alias CMS.Docs.Branch
  alias CMS.FrontDesk.Community, as: CommunityReader
  alias CMS.Gate.Context.Scope.Article, as: ArticleContext
  alias CMS.Gate.Context.Scope.Doc, as: DocContext
  alias CMS.Helper.ArticlePath
  alias CMS.Model.Community
  alias Helper.ORM

  @doc "Reads one Article through the actor-aware Article Insights scope."
  @spec read_insights(ArticlePath.t(), term(), keyword()) :: {:ok, struct()} | {:error, map()}
  def read_insights(article_path, actor, opts \\ []) do
    with {:ok, %{community: community_ref, thread: thread, inner_id: inner_id}} <-
           ArticlePath.parse(article_path),
         %Community{} = community <-
           Repo.one(
             from(row in Community,
               where: row.slug == ^community_ref or row.aka == ^community_ref
             )
           ),
         {:ok, info} <- match(thread),
         {:ok, scope_context} <- insights_scope_context(thread, opts),
         %Ecto.Query{} = query <- CMS.Gate.scope(info.model, actor, :read_insights, scope_context),
         {:ok, article} <-
           query
           |> where(
             [article],
             article.community_id == ^community.id and article.inner_id == ^inner_id
           )
           |> Repo.one()
           |> done(),
         {:ok, article} <- ORM.fill_meta(article) do
      {:ok, article}
    else
      nil -> {:error, ArticleErrorCat.article_not_found("article not found")}
      {:error, _} -> {:error, ArticleErrorCat.article_not_found("article not found")}
    end
  end

  @doc "Reads one public Article from a structured path."
  @spec read(ArticlePath.t(), keyword()) :: {:ok, struct()} | {:error, map()}
  def read(article_path, opts) do
    with {:ok, %{community: community, thread: thread, inner_id: inner_id}} <-
           ArticlePath.parse(article_path),
         {:ok, community} <- CommunityReader.read(community) do
      read(community, thread, inner_id, opts)
    end
  end

  @doc "Loads one public canonical Article for an explicit ViewTracker request."
  @spec read_for_view_tracking(ArticlePath.t()) :: {:ok, struct()} | {:error, map()}
  def read_for_view_tracking(article_path) do
    with {:ok, %{community: community_ref, thread: thread, inner_id: inner_id}} <-
           ArticlePath.parse(article_path),
         {:ok, %Community{id: community_id} = community} <- CommunityReader.read(community_ref),
         {:ok, info} <- match(thread),
         {:ok, scope_context} <- public_scope_context(community, thread, []),
         %Ecto.Query{} = query <- CMS.Gate.scope(info.model, nil, :read, scope_context),
         {:ok, article} <-
           query
           |> where(
             [article],
             article.community_id == ^community_id and article.inner_id == ^inner_id
           )
           |> Repo.one()
           |> done() do
      {:ok, article}
    else
      {:error, _} -> {:error, ArticleErrorCat.article_not_found("article not found")}
    end
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

    articles_by_path =
      parsed
      |> Enum.group_by(&{&1.community, &1.thread})
      |> Enum.reduce(%{}, fn {{community_ref, thread}, group_paths}, acc ->
        Map.merge(acc, read_path_group(community_ref, thread, group_paths))
      end)

    {:ok,
     Enum.flat_map(parsed, fn path ->
       case Map.fetch(articles_by_path, article_path_key(path)) do
         {:ok, article} -> [%{path: path, article: article}]
         :error -> []
       end
     end)}
  end

  defp read_path_group(community_ref, thread, paths) do
    inner_ids = Enum.map(paths, & &1.inner_id)

    with {:ok, %Community{id: community_id} = community} <- CommunityReader.read(community_ref),
         {:ok, info} <- match(thread),
         {:ok, scope_context} <- public_scope_context(community, thread, []),
         %Ecto.Query{} = query <- CMS.Gate.scope(info.model, nil, :read, scope_context) do
      query
      |> where([article, ...], article.community_id == ^community_id)
      |> where([article, ...], article.inner_id in ^inner_ids)
      |> Repo.all()
      |> Map.new(fn article ->
        {article_path_key(%{
           community: community_ref,
           thread: thread,
           inner_id: article.inner_id
         }), article}
      end)
    else
      _ -> %{}
    end
  end

  defp article_path_key(path),
    do: {path.community, path.thread, to_string(path.inner_id)}

  @doc "Locks one physical Article and revalidates its public Gate/Lifecycle scope."
  @spec lock_for_view_tracking(struct()) ::
          {:ok, struct(), Community.t(), DateTime.t()} | {:error, map()}
  def lock_for_view_tracking(article) when is_struct(article) do
    with {:ok, %{artiment: thread}} <- match_interaction(article),
         {locked, %DateTime{} = received_at} <- lock_physical_article(article),
         %Community{} = community <- Repo.get(Community, locked.community_id),
         {:ok, scope_context} <- public_scope_context(community, thread, []),
         %Ecto.Query{} = query <- CMS.Gate.scope(locked.__struct__, nil, :read, scope_context),
         scoped when not is_nil(scoped) <-
           query
           |> where([row, ...], row.id == ^locked.id)
           |> Repo.one() do
      {:ok, scoped, community, received_at}
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
    with {:ok, %Community{id: community_id} = community} <- CommunityReader.read(community_ref),
         {:ok, info} <- match(thread),
         {:ok, scope_context} <- public_scope_context(community, thread, []),
         %Ecto.Query{} = query <- CMS.Gate.scope(info.model, nil, :read, scope_context) do
      rows =
        query
        |> where([article, ...], article.community_id == ^community_id)
        |> where([article, ...], article.inner_id in ^inner_ids)
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

  @doc "Reads one public Article from canonical Community/thread/id coordinates."
  @spec read(Community.t(), atom(), integer() | String.t(), keyword()) ::
          {:ok, struct()} | {:error, map()}
  def read(%Community{id: community_id} = community, thread, inner_id, opts) do
    preload = Keyword.get(opts, :preload, [])

    with {:ok, info} <- match(thread),
         {:ok, scope_context} <- public_scope_context(community, thread, opts),
         %Ecto.Query{} = query <- CMS.Gate.scope(info.model, nil, :read, scope_context),
         {:ok, article} <-
           query
           |> where(
             [article],
             article.community_id == ^community_id and article.inner_id == ^inner_id
           )
           |> preload(^preload)
           |> Repo.one()
           |> done(),
         {:ok, article} <- ORM.fill_meta(article) do
      Response.one(article, nil)
    else
      {:error, _} -> {:error, ArticleErrorCat.article_not_found("article not found")}
    end
  end

  defp public_scope_context(%Community{} = community, :doc, opts) do
    with {:ok, branch} <- Branch.resolve(community, Branch.main_slug()) do
      {:ok,
       DocContext.public_branch(branch.id,
         include_illegal: Keyword.get(opts, :include_illegal, false)
       )}
    end
  end

  defp public_scope_context(_community, thread, opts),
    do:
      {:ok,
       ArticleContext.public(thread, include_illegal: Keyword.get(opts, :include_illegal, false))}

  defp lock_physical_article(article) do
    from(row in article.__struct__,
      where: row.id == ^article.id,
      lock: "FOR KEY SHARE",
      select: {
        row,
        type(fragment("date_trunc('second', clock_timestamp())"), :utc_datetime)
      }
    )
    |> Repo.one()
  end

  defp insights_scope_context(:doc, opts),
    do:
      {:ok,
       DocContext.insights(
         passport_granted_community_slugs:
           Keyword.get(opts, :passport_granted_community_slugs, [])
       )}

  defp insights_scope_context(thread, opts),
    do:
      {:ok,
       ArticleContext.insights(thread,
         passport_granted_community_slugs:
           Keyword.get(opts, :passport_granted_community_slugs, [])
       )}

  defp done(nil), do: {:error, ErrorCat.custom(%{reason: :not_exist})}
  defp done(result), do: {:ok, result}
end
