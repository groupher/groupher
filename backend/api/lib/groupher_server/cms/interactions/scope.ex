defmodule GroupherServer.CMS.Interactions.Scope do
  @moduledoc """
  Compiles Interaction-owned ordering into an existing Article queryable.

      Article Reader queryable
        -> Interactions.Scope
        -> ReactionInfo LEFT JOIN when required
        -> composed Ecto query
  """

  import Ecto.Query

  alias GroupherServer.CMS.Artiment.Matcher
  alias GroupherServer.CMS.Articles.Const, as: ArticlesConst
  alias GroupherServer.CMS.Interactions.{Config, ErrorCat}

  @article_types Config.article_threads()
  @passthrough_orders [nil | ArticlesConst.native_order_values()]

  @type result :: {:ok, Ecto.Query.t()} | {:error, GroupherServer.ErrorCat.Error.t()}

  @doc """
  Validates the order and returns a composed Article query without executing it.

  ## Examples

      Scope.scope(Post, order: :upvotes)

  """
  @spec scope(Ecto.Queryable.t(), keyword()) :: result()
  def scope(queryable, opts) when is_list(opts) do
    order = Keyword.get(opts, :order)

    with :ok <- validate_order(order),
         {:ok, query} <- to_query(queryable),
         {:ok, info} <- interaction_info(query) do
      compile_order(query, info, order)
    end
  end

  def scope(_queryable, _opts),
    do: {:error, ErrorCat.unsupported_artiment_query("scope options must be a keyword list")}

  defp validate_order(order) do
    if ArticlesConst.valid_order?(order),
      do: :ok,
      else: {:error, ErrorCat.unsupported_order(inspect(order))}
  end

  defp to_query(queryable) do
    {:ok, Ecto.Queryable.to_query(queryable)}
  rescue
    Protocol.UndefinedError ->
      {:error, ErrorCat.unsupported_artiment_query(inspect(queryable))}
  end

  defp interaction_info(%Ecto.Query{from: %{source: {_source, schema}}}) when is_atom(schema) do
    with {:ok, %{artiment: artiment} = info} <- Matcher.match_interaction(schema),
         true <- artiment in @article_types do
      {:ok, info}
    else
      _ -> {:error, ErrorCat.unsupported_artiment_query(inspect(schema))}
    end
  end

  defp interaction_info(_query),
    do: {:error, ErrorCat.unsupported_artiment_query("query has no Article root schema")}

  defp compile_order(query, _info, order)
       when order in @passthrough_orders,
       do: {:ok, query}

  defp compile_order(query, info, :upvotes),
    do: {:ok, order_by_count(query, info, :upvotes_count)}

  defp compile_order(query, info, :collects),
    do: {:ok, order_by_count(query, info, :collects_count)}

  defp order_by_count(query, info, count_field) do
    query
    |> exclude(:order_by)
    |> then(fn query ->
      from(article in query,
        left_join: reaction_info in ^info.reaction_info_model,
        on: field(reaction_info, ^info.foreign_key) == article.id,
        order_by: [
          desc_nulls_last: field(reaction_info, ^count_field),
          desc_nulls_last: article.id
        ]
      )
    end)
  end
end
