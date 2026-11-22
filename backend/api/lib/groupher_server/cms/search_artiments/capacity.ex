defmodule GroupherServer.CMS.SearchArtiments.Capacity do
  @moduledoc """
  Measures the source volume used for search platform cost estimates.

  Business position:

      Resolver / Oban
        -> CMS.SearchArtiments
        -> Capacity
        -> search platform
  """

  import Ecto.Query, warn: false
  alias GroupherServer.{CMS, Repo}

  alias CMS.Gate.Context.Scope.Article, as: ArticleContext
  alias CMS.Gate.Context.Scope.Doc, as: DocContext

  alias CMS.Model.{
    Article,
    ArticlePublic,
    ArticlePublicBody,
    Comment,
    CommentLifecycle,
    CommentReviewBlock
  }

  alias CMS.SearchArtiments.Config

  @article_threads Config.article_threads()

  @doc """
  Measures the source volume used for search platform cost estimates.

  Returns per-thread public article counts, current public body plain text byte
  stats, and comment counts with body byte percentiles.
  """
  @spec measure() :: map()
  def measure do
    %{
      articles: article_counts(),
      article_documents: article_documents(),
      comments: comment_counts()
    }
  end

  defp article_counts do
    Map.new(@article_threads, fn thread ->
      count =
        Article
        |> CMS.Gate.scope(nil, :list, scope_context(thread))
        |> Repo.aggregate(:count, :id)

      {thread, count}
    end)
  end

  @doc "Measures Article-only public body bytes after Gate admission, independently of Comment storage."
  def article_documents do
    @article_threads
    |> Enum.map(fn thread ->
      visible_ids =
        Article
        |> CMS.Gate.scope(nil, :list, scope_context(thread))
        |> select([article, ...], article.id)
        |> distinct(true)

      {count, average, maximum} =
        from(public in ArticlePublic,
          join: body in ArticlePublicBody,
          on: body.article_id == public.article_id and body.snapshot_id == public.snapshot_id,
          where: public.article_id in subquery(visible_ids),
          select:
            {count(body.article_id), avg(fragment("octet_length(?)", body.plain_text)),
             max(fragment("octet_length(?)", body.plain_text))}
        )
        |> Repo.one()

      {thread,
       %{
         count: count,
         average_plain_text_bytes: decimal_to_number(average),
         maximum_plain_text_bytes: default_zero(maximum)
       }}
    end)
    |> Enum.reject(fn {_, stats} -> stats.count == 0 end)
    |> Map.new()
  end

  defp comment_counts do
    base =
      from(comment in Comment, as: :capacity_comment)
      |> join(:inner, [comment], body in GroupherServer.CMS.Model.CommentBody,
        on: body.comment_id == comment.id
      )
      |> join(:inner, [comment], lifecycle in CommentLifecycle,
        as: :capacity_comment_lifecycle,
        on: lifecycle.comment_id == comment.id
      )
      |> where([comment, lifecycle], lifecycle.state == :visible)
      |> where(
        [comment, ...],
        not exists(
          from(restriction in CommentReviewBlock,
            where:
              restriction.comment_id == parent_as(:capacity_comment_lifecycle).comment_id and
                is_nil(restriction.resolved_at) and
                (is_nil(restriction.community_id) or
                   restriction.community_id == parent_as(:capacity_comment).community_id),
            select: 1
          )
        )
      )

    {p50, p95, p99} = comment_body_percentiles(base)

    %{
      searchable: Repo.aggregate(base, :count, :id),
      total: Repo.aggregate(Comment, :count, :id),
      average_body_bytes:
        base
        |> select([_comment, body], avg(fragment("octet_length(?)", body.json)))
        |> Repo.one()
        |> decimal_to_number(),
      maximum_body_bytes:
        base
        |> select([_comment, body], max(fragment("octet_length(?)", body.json)))
        |> Repo.one()
        |> default_zero(),
      body_bytes_p50: default_zero(p50),
      body_bytes_p95: default_zero(p95),
      body_bytes_p99: default_zero(p99)
    }
  end

  defp comment_body_percentiles(query) do
    query
    |> select([_comment, body], {
      fragment("percentile_cont(0.50) WITHIN GROUP (ORDER BY octet_length(?))", body.json),
      fragment("percentile_cont(0.95) WITHIN GROUP (ORDER BY octet_length(?))", body.json),
      fragment("percentile_cont(0.99) WITHIN GROUP (ORDER BY octet_length(?))", body.json)
    })
    |> Repo.one()
  end

  defp decimal_to_number(nil), do: 0
  defp decimal_to_number(%Decimal{} = value), do: Decimal.to_float(value)
  defp decimal_to_number(value), do: value

  defp scope_context(:doc), do: DocContext.public()
  defp scope_context(thread), do: ArticleContext.public(thread)

  defp default_zero(nil), do: 0
  defp default_zero(value), do: value
end
