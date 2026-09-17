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
  alias CMS.ViewTracker.Model.ViewSummary
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

  @doc "Reads one public scoped Summary batch without loading Articles one by one."
  @spec read_view_summaries(String.t(), atom(), [String.t() | integer()]) ::
          {:ok, [map()]} | {:error, map()}
  def read_view_summaries(community_ref, thread, inner_ids)
      when is_binary(community_ref) and is_atom(thread) and is_list(inner_ids) do
    with {:ok, inner_ids} <- normalize_inner_ids(inner_ids),
         {:ok, %Community{id: community_id} = community} <- CommunityReader.read(community_ref),
         {:ok, info} <- match(thread),
         {:ok, scope_context} <- public_scope_context(community, thread, []),
         %Ecto.Query{} = query <- CMS.Gate.scope(info.model, nil, :read, scope_context) do
      thread_value = Atom.to_string(thread)

      rows =
        query
        |> join(:left, [article, ...], summary in ViewSummary,
          as: :view_summary,
          on: summary.thread == ^thread_value and summary.article_id == article.id
        )
        |> where([article, ...], article.community_id == ^community_id)
        |> where([article, ...], article.inner_id in ^inner_ids)
        |> select([article, ...], %{
          inner_id: article.inner_id,
          views: coalesce(as(:view_summary).views, 0),
          revision: coalesce(as(:view_summary).revision, 0)
        })
        |> Repo.all()
        |> Enum.map(&Map.merge(&1, %{community: community_ref, thread: thread}))

      {:ok, rows}
    else
      {:error, _} -> {:error, ArticleErrorCat.article_not_found("article not found")}
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
      {:ok, ids} -> {:ok, ids |> Enum.uniq() |> Enum.reverse() |> Enum.take(100)}
      :error -> {:error, ArticleErrorCat.article_not_found("invalid article ids")}
    end
  end

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
