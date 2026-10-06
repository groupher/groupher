defmodule GroupherServer.CMS.Interactions.Scope do
  @moduledoc """
  Compiles Interaction-owned ordering into an existing Article queryable.

      Article Query queryable
        -> Interactions.Scope
        -> ReactionInfo LEFT JOIN when required
        -> composed Ecto query
  """

  import Ecto.Query

  alias GroupherServer.CMS

  alias CMS.Artiment.Matcher
  alias CMS.Articles.Const, as: ArticlesConst
  alias CMS.Interactions.{Config, ErrorCat}
  alias CMS.Model.{Article, ArticleStats}

  @article_types Config.article_threads()
  @passthrough_orders [nil | ArticlesConst.native_order_values()]

  @type result :: {:ok, Ecto.Query.t()} | {:error, ErrorCat.error()}

  @doc """
  Validates the order and returns a composed Article query without executing it.

  ## Examples

      Scope.scope(Article, thread: :post, order: :upvotes)

  """
  @spec scope(Ecto.Queryable.t(), keyword()) :: result()
  def scope(queryable, opts) when is_list(opts) do
    order = Keyword.get(opts, :order)

    with :ok <- validate_order(order),
         {:ok, query} <- to_query(queryable),
         {:ok, info} <- interaction_info(query, opts) do
      compile_order(query, info, order)
    end
  end

  def scope(_queryable, _opts) do
    {:error, ErrorCat.unsupported_artiment_query("scope options must be a keyword list")}
  end

  defp validate_order(order) do
    if ArticlesConst.valid_order?(order) do
      :ok
    else
      {:error, ErrorCat.unsupported_order(inspect(order))}
    end
  end

  defp to_query(queryable) do
    {:ok, Ecto.Queryable.to_query(queryable)}
  rescue
    Protocol.UndefinedError ->
      {:error, ErrorCat.unsupported_artiment_query(inspect(queryable))}
  end

  defp interaction_info(%Ecto.Query{from: %{source: {_source, Article}}}, opts) do
    case Keyword.get(opts, :thread) do
      thread when thread in @article_types -> Matcher.match_interaction(thread)
      _ -> {:error, ErrorCat.unsupported_artiment_query("stable Article query requires thread")}
    end
  end

  defp interaction_info(%Ecto.Query{from: %{source: {_source, schema}}}, _opts)
       when is_atom(schema) do
    with {:ok, %{artiment: artiment} = info} <- Matcher.match_interaction(schema),
         true <- artiment in @article_types do
      {:ok, info}
    else
      _ -> {:error, ErrorCat.unsupported_artiment_query(inspect(schema))}
    end
  end

  defp interaction_info(_query, _opts) do
    {:error, ErrorCat.unsupported_artiment_query("query has no Article root schema")}
  end

  defp compile_order(query, _info, order)
       when order in @passthrough_orders do
    {:ok, query}
  end

  defp compile_order(query, info, :upvotes) do
    {:ok, order_by_count(query, info, :upvotes_count)}
  end

  defp compile_order(query, info, :collects) do
    {:ok, order_by_count(query, info, :collects_count)}
  end

  defp order_by_count(query, info, count_field) do
    thread = info.artiment

    query
    |> exclude(:order_by)
    |> then(fn query ->
      from(article in query,
        left_join: stats in ArticleStats,
        on: stats.thread == ^Atom.to_string(thread) and stats.article_id == article.id,
        order_by: [
          desc_nulls_last: field(stats, ^count_field),
          asc: article.id
        ]
      )
    end)
  end
end
