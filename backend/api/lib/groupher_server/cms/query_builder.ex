defmodule GroupherServer.CMS.QueryBuilder do
  @moduledoc """
  Compiles CMS-owned Article and Community filter vocabulary into Ecto queries.

      CMS or CMS-model consumer
        -> CMS.QueryBuilder
        -> Helper.QueryBuilder generic clauses
        -> Ecto query
  """

  import Ecto.Query, warn: false

  alias GroupherServer.CMS.Artiment.{Const, Threads}
  alias Helper.QueryBuilder, as: GenericQueryBuilder

  @article_cat Const.cat_values()
  @article_status Const.status_values()
  @threads Threads.enums()
  @audit_illegal Const.moderation_state(:illegal)
  @audit_failed Const.moderation_state(:audit_failed)

  @doc "Applies CMS-owned filters, delegating generic clauses to `Helper.QueryBuilder`."
  @spec filter_pack(Ecto.Queryable.t(), map()) :: Ecto.Query.t()
  def filter_pack(queryable, filter) when is_map(filter) do
    queryable
    |> handle_order_logic(filter)
    |> GenericQueryBuilder.filter_pack(filter)
    |> handle_article_relate_logic(filter)
    |> handle_community_relate_logic(filter)
  end

  @doc "Loads users joined through a CMS relation and applies the supplied filters."
  @spec load_inner_users(Ecto.Queryable.t(), map()) :: Ecto.Query.t()
  def load_inner_users(queryable, filter) do
    queryable
    |> join(:inner, [record], user in assoc(record, :user))
    |> select([_record, user], user)
    |> filter_pack(filter)
  end

  @doc "Compatibility hook for callers that have no additional CMS domain clause."
  @spec domain_query(Ecto.Queryable.t(), map()) :: Ecto.Queryable.t()
  def domain_query(queryable, _filter), do: queryable

  defp handle_order_logic(queryable, filter) do
    Enum.reduce(filter, queryable, fn
      {:order, nil}, query -> query
      {:order, key}, query when is_atom(key) -> trans_articles_order(query, key)
      {_, _}, query -> query
    end)
  end

  defp handle_article_relate_logic(queryable, filter) do
    Enum.reduce(filter, queryable, fn
      {:length, :most_words}, query ->
        order_by(query, desc: :length)

      {:length, :least_words}, query ->
        order_by(query, asc: :length)

      {:article_tag, tag_name}, query ->
        from(q in query,
          join: tag in assoc(q, :community_tags),
          where: tag.slug == ^tag_name
        )

      {:community_tag, tag_name}, query ->
        from(q in query,
          join: tag in assoc(q, :community_tags),
          where: tag.slug == ^tag_name
        )

      {:article_tags, tag_names}, query ->
        from(q in query,
          join: tag in assoc(q, :community_tags),
          where: tag.slug in ^tag_names,
          distinct: q.id,
          group_by: q.id
        )

      {:community_tags, tag_names}, query ->
        from(q in query,
          join: tag in assoc(q, :community_tags),
          where: tag.slug in ^tag_names,
          distinct: q.id,
          group_by: q.id
        )

      {:cat, nil}, query ->
        query

      {:status, nil}, query ->
        query

      {:cat, cat}, query ->
        trans_article_cat(query, cat)

      {:status, status}, query ->
        trans_article_status(query, status)

      {:pending, :legal}, query ->
        where(query, [article], article.pending != ^@audit_illegal)

      {:pending, :audit_failed}, query ->
        where(query, [article], article.pending == ^@audit_failed)

      {_, _}, query ->
        query
    end)
  end

  defp handle_community_relate_logic(queryable, filter) do
    Enum.reduce(filter, queryable, fn
      {:category, category_slug}, query ->
        from(q in query,
          join: category in assoc(q, :categories),
          where: category.slug == ^category_slug
        )

      {:thread, thread}, query ->
        if is_atom(thread) and thread in @threads,
          do: from(q in query, where: q.thread == ^thread),
          else: from(q in query, where: false)

      {:community_id, community_id}, query ->
        from(q in query,
          join: community in assoc(q, :community),
          where: community.id == ^community_id
        )

      {:community_slug, community_slug}, query ->
        from(q in query,
          join: community in assoc(q, :community),
          where: community.slug == ^community_slug
        )

      {:community, community_slug}, query ->
        from(q in query,
          join: community in assoc(q, :communities),
          where: community.slug == ^community_slug
        )

      {_, _}, query ->
        query
    end)
  end

  defp trans_article_cat(queryable, cat) when is_atom(cat) do
    if cat in @article_cat,
      do: where(queryable, [article], article.cat == ^cat),
      else: where(queryable, [article], article.id == -1)
  end

  defp trans_article_status(queryable, status) when is_atom(status) do
    if status in @article_status,
      do: where(queryable, [article], article.status == ^status),
      else: where(queryable, [article], article.id == -1)
  end

  defp trans_articles_order(queryable, :upvotes), do: queryable
  defp trans_articles_order(queryable, :comments), do: order_by(queryable, desc: :comments_count)

  defp trans_articles_order(queryable, :views),
    do: order_by(queryable, desc: :views, desc: :inserted_at)

  defp trans_articles_order(queryable, :publish), do: order_by(queryable, desc: :inserted_at)
  defp trans_articles_order(queryable, _order), do: queryable
end
