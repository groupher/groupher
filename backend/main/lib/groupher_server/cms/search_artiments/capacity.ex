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
  import GroupherServer.CMS.Artiment.Matcher

  alias GroupherServer.{CMS, Repo}
  alias CMS.Gate.Context.Scope.Article, as: ArticleScope
  alias CMS.Gate.Context.Scope.Doc, as: DocScope
  alias CMS.Model.{ArticleDocument, Comment, CommentLifecycle}
  alias CMS.SearchArtiments.Config
  alias Helper.Constant

  require CMS.Const
  @article_threads Config.article_threads()

  @legal Constant.CMS.pending(:legal)

  @doc """
  Measures the source volume used for search platform cost estimates.

  Returns per-thread public article counts, ArticleDocument plain text byte
  stats, and comment counts with body byte percentiles.
  """
  @spec measure() :: map()
  def measure do
    %{
      articles: article_counts(),
      article_documents: article_document_bytes(),
      comments: comment_counts()
    }
  end

  defp article_counts do
    Map.new(@article_threads, fn thread ->
      {:ok, info} = match(thread)

      count =
        info.model
        |> CMS.Gate.scope(nil, :list, scope_context(thread))
        |> where([article], article.stage == ^CMS.Const.stage(:public))
        |> where([article], article.pending == ^@legal)
        |> Repo.aggregate(:count, :id)

      {thread, count}
    end)
  end

  defp article_document_bytes do
    ArticleDocument
    |> group_by([document], document.thread)
    |> select([document], {
      document.thread,
      count(document.id),
      avg(fragment("octet_length(?)", document.plain_text)),
      max(fragment("octet_length(?)", document.plain_text))
    })
    |> Repo.all()
    |> Map.new(fn {thread, count, average, maximum} ->
      {thread,
       %{
         count: count,
         average_plain_text_bytes: decimal_to_number(average),
         maximum_plain_text_bytes: maximum || 0
       }}
    end)
  end

  defp comment_counts do
    base =
      Comment
      |> join(:inner, [comment], lifecycle in CommentLifecycle,
        on: lifecycle.comment_id == comment.id
      )
      |> where([comment, lifecycle], lifecycle.state == :visible and comment.pending == ^@legal)

    {p50, p95, p99} = comment_body_percentiles(base)

    %{
      searchable: Repo.aggregate(base, :count, :id),
      total: Repo.aggregate(Comment, :count, :id),
      average_body_bytes:
        base
        |> select([comment], avg(fragment("octet_length(?)", comment.body)))
        |> Repo.one()
        |> decimal_to_number(),
      maximum_body_bytes:
        base
        |> select([comment], max(fragment("octet_length(?)", comment.body)))
        |> Repo.one()
        |> default_zero(),
      body_bytes_p50: default_zero(p50),
      body_bytes_p95: default_zero(p95),
      body_bytes_p99: default_zero(p99)
    }
  end

  defp comment_body_percentiles(query) do
    query
    |> select([comment], {
      fragment("percentile_cont(0.50) WITHIN GROUP (ORDER BY octet_length(?))", comment.body),
      fragment("percentile_cont(0.95) WITHIN GROUP (ORDER BY octet_length(?))", comment.body),
      fragment("percentile_cont(0.99) WITHIN GROUP (ORDER BY octet_length(?))", comment.body)
    })
    |> Repo.one()
  end

  defp decimal_to_number(nil), do: 0
  defp decimal_to_number(%Decimal{} = value), do: Decimal.to_float(value)
  defp decimal_to_number(value), do: value

  defp scope_context(:doc), do: DocScope.public_main()
  defp scope_context(thread), do: ArticleScope.public(thread)

  defp default_zero(nil), do: 0
  defp default_zero(value), do: value
end
