defmodule GroupherServer.CMS.AbuseReports.Query do
  @moduledoc """
  Query operations for abuse reports.

  Business position:

      GraphQL resolver / job
        -> CMS facade
        -> Query
        -> Repo / external boundary
  """

  import Ecto.Query, warn: false
  import GroupherServer.CMS.Artiment.Matcher
  import ShortMaps
  import Helper.Utils, only: [done: 1]

  alias GroupherServer.{CMS, Repo}

  alias CMS.FrontDesk
  alias CMS.QueryBuilder
  alias CMS.Model.{AbuseReport, Comment}
  alias Helper.{ORM, T}

  @threads CMS.Artiment.Config.threads()

  @export_author_keys [:id, :login, :nickname, :avatar]
  @export_article_keys [:id, :inner_id, :title, :digest, :article_stats]
  @export_report_keys [
    :id,
    :deal_with,
    :operate_user,
    :report_cases,
    :report_cases_count,
    :inserted_at,
    :updated_at
  ]

  @doc """
  Returns a paged list of abuse reports for one filter.

  The `content_type` filter selects the target shape: `:account`, `:comment`,
  or a content thread. Each shape preloads and projects the matching target
  info onto the report entries.

  ## Examples

      AbuseReports.Query.paged_reports(%{
        content_type: :post,
        content_id: post.id,
        page: 1,
        size: 20
      })

  """
  @spec paged_reports(map()) :: T.domain_res(T.paged_data())
  def paged_reports(%{content_type: :account, content_id: content_id} = filter) do
    with {:ok, info} <- match(:account) do
      query =
        from(r in AbuseReport,
          where: field(r, ^info.foreign_key) == ^content_id,
          preload: :account
        )

      do_paged_reports(query, :account, filter)
    end
  end

  @spec paged_reports(map()) :: T.domain_res(T.paged_data())
  def paged_reports(%{content_type: :account} = filter) do
    query =
      from(report in AbuseReport,
        where: not is_nil(report.account_id),
        preload: [account: [], operate_user: []]
      )

    do_paged_reports(query, :account, filter)
  end

  @spec paged_reports(map()) :: T.domain_res(T.paged_data())
  def paged_reports(%{content_type: :comment, content_id: content_id} = filter) do
    with {:ok, info} <- match(:comment) do
      query =
        from(r in AbuseReport,
          where: field(r, ^info.foreign_key) == ^content_id,
          preload: [comment: :author]
        )

      do_paged_reports(query, :comment, filter)
    end
  end

  @spec paged_reports(map()) :: T.domain_res(T.paged_data())
  def paged_reports(%{content_type: :comment} = filter) do
    query =
      from(report in AbuseReport,
        where: not is_nil(report.comment_id),
        preload: [comment: :author, operate_user: []]
      )

    do_paged_reports(query, :comment, filter)
  end

  @spec paged_reports(map()) :: T.domain_res(T.paged_data())
  def paged_reports(%{content_type: thread, content_id: content_id} = filter)
      when thread in @threads do
    case Ecto.UUID.cast(content_id) do
      {:ok, article_id} ->
        query =
          from(r in AbuseReport,
            where: r.article_id == ^article_id,
            preload: [:article, :operate_user]
          )

        do_paged_reports(query, thread, filter)

      :error ->
        {:ok, %{entries: [], total_count: 0, page_number: filter.page, page_size: filter.size}}
    end
  end

  @spec paged_reports(map()) :: T.domain_res(T.paged_data())
  def paged_reports(%{content_type: thread} = filter) when thread in @threads do
    query =
      from(report in AbuseReport,
        join: article in assoc(report, :article),
        where: article.thread == ^thread,
        preload: [article: :community, operate_user: []]
      )

    do_paged_reports(query, thread, filter)
  end

  @spec paged_reports(map()) :: T.domain_res(T.paged_data())
  def paged_reports(filter) do
    query = from(r in AbuseReport, preload: [:operate_user])
    do_paged_reports(query, filter)
  end

  defp do_paged_reports(query, thread, filter) do
    %{page: page, size: size} = filter

    formatted =
      query
      |> QueryBuilder.filter_pack(Map.drop(filter, [:content_type, :content_id]))
      |> ORM.paginator(~m(page size)a)
      |> reports_formatter(thread)

    case formatted do
      {:error, _} = error -> error
      result -> done(result)
    end
  end

  defp do_paged_reports(query, %{page: page, size: size}) do
    query |> ORM.paginator(~m(page size)a) |> done()
  end

  defp reports_formatter(%{entries: entries} = paged_reports, :account) do
    paged_reports
    |> Map.put(
      :entries,
      Enum.map(entries, fn report ->
        basic_report = report |> Map.take(@export_report_keys)
        basic_report |> Map.put(:account, extract_account_info(report))
      end)
    )
  end

  defp reports_formatter(%{entries: entries} = paged_reports, :comment) do
    with {:ok, comments} <-
           Enum.reduce_while(entries, {:ok, []}, fn report, {:ok, acc} ->
             basic_report = Map.take(report, @export_report_keys)

             case extract_article_comment_info(report) do
               {:ok, comment} ->
                 {:cont, {:ok, [Map.put(basic_report, :comment, comment) | acc]}}

               {:error, _} = error ->
                 {:halt, error}
             end
           end) do
      Map.put(paged_reports, :entries, Enum.reverse(comments))
    end
  end

  defp reports_formatter(%{entries: entries} = paged_reports, thread)
       when thread in @threads do
    with {:ok, stats} <- article_stats(entries, thread),
         {:ok, articles} <-
           Enum.reduce_while(entries, {:ok, []}, fn report, {:ok, acc} ->
             basic_report = Map.take(report, @export_report_keys)

             case extract_article_info(thread, report, stats) do
               {:ok, article} ->
                 {:cont, {:ok, [Map.put(basic_report, :article, article) | acc]}}

               {:error, _} = error ->
                 {:halt, error}
             end
           end) do
      Map.put(paged_reports, :entries, Enum.reverse(articles))
    end
  end

  defp extract_account_info(%AbuseReport{} = report) do
    report |> Map.get(:account) |> Map.take(@export_author_keys)
  end

  defp extract_article_info(thread, %AbuseReport{} = report, stats) do
    article = report.article || Map.get(report, thread)

    with {:ok, article} <- public_article(article),
         {:ok, article} <- article_with_projection_count(article, thread, stats) do
      {:ok, article |> Map.take(@export_article_keys) |> Map.merge(%{thread: thread})}
    end
  end

  defp public_article(%CMS.Model.Article{} = article) do
    article = Repo.preload(article, :community)

    FrontDesk.article(%{
      community: article.community.slug,
      thread: article.thread,
      inner_id: article.inner_id
    })
  end

  defp public_article(article), do: {:ok, article}

  defp extract_article_comment_info(%AbuseReport{} = report) do
    keys = [:id, :inner_id, :floor, :upvotes_count, :body_html]
    author = Map.take(report.comment.author, @export_author_keys)

    counts =
      CMS.Interactions.counts([report.comment]) |> Map.get({:comment, report.comment.id}, %{})

    comment =
      report.comment
      |> Map.put(:upvotes_count, Map.get(counts, :upvotes_count, 0))
      |> Map.take(keys)

    comment = Map.merge(comment, %{author: author})

    with {:ok, article} <- extract_article_in_comment(report.comment) do
      {:ok, Map.merge(comment, %{article: article})}
    end
  end

  defp extract_article_in_comment(%Comment{} = comment) do
    if is_binary(comment.article_id) do
      with {:ok, article} <- FrontDesk.article_of(comment),
           {:ok, article} <- article_with_projection_count(article, comment.thread) do
        {:ok, article |> Map.take(@export_article_keys) |> Map.merge(%{thread: comment.thread})}
      end
    else
      extract_legacy_article_in_comment(comment)
    end
  end

  defp extract_legacy_article_in_comment(%Comment{} = comment) do
    thread =
      Enum.find(@threads, fn thread ->
        not is_nil(Map.get(comment, :"#{thread}_id"))
      end)

    case thread do
      nil ->
        {:ok, %{thread: nil}}

      thread ->
        case Map.get(comment, thread) do
          nil ->
            {:ok, %{thread: thread}}

          %Ecto.Association.NotLoaded{} ->
            {:ok, %{thread: thread}}

          article ->
            with {:ok, article} <- article_with_projection_count(article, thread) do
              {:ok, article |> Map.take(@export_article_keys) |> Map.merge(%{thread: thread})}
            end
        end
    end
  end

  defp article_with_projection_count(article, thread) do
    article_with_projection_count(article, thread, nil)
  end

  defp article_with_projection_count(%{id: id} = article, thread, nil)
       when is_binary(id) and not is_struct(article) do
    stats = Repo.get_by(CMS.Model.ArticleStats, article_id: id, thread: thread)
    {:ok, Map.put(article, :article_stats, stats)}
  end

  defp article_with_projection_count(%{id: id} = article, thread, stats) do
    with {:ok, article_stats} <- article_stats_for_article(article, thread, stats) do
      projection = if is_map(article_stats), do: Map.get(article_stats, {thread, id})
      {:ok, Map.put(article, :article_stats, projection)}
    end
  end

  defp article_with_projection_count(_article, _thread, _summaries) do
    {:error, CMS.Articles.ErrorCat.projection_not_updated()}
  end

  defp article_stats_for_article(article, thread, nil) do
    case CMS.ArticleStats.for_public_articles(thread, [article]) do
      stats when is_map(stats) -> {:ok, stats}
      {:error, _} -> {:ok, nil}
    end
  end

  defp article_stats_for_article(_article, _thread, stats) when is_map(stats), do: {:ok, stats}

  defp article_stats(entries, thread) do
    articles =
      entries
      |> Enum.map(&(Map.get(&1, :article) || Map.get(&1, thread)))
      |> Enum.reject(&is_nil/1)

    case CMS.ArticleStats.for_public_articles(thread, articles) do
      stats when is_map(stats) -> {:ok, stats}
      {:error, _} -> {:ok, nil}
    end
  end
end
