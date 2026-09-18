defmodule GroupherServer.CMS.AbuseReports.List do
  @moduledoc """
  List operations for abuse reports.

  Business position:

      GraphQL resolver / job
        -> CMS facade
        -> List
        -> Repo / external boundary
  """

  import Ecto.Query, warn: false
  import GroupherServer.CMS.Artiment.Matcher
  import ShortMaps
  import Helper.Utils, only: [done: 1]

  alias GroupherServer.CMS

  alias CMS.QueryBuilder
  alias CMS.Model.{AbuseReport, Comment}
  alias Helper.{ORM, T}

  @threads CMS.Artiment.Config.threads()

  @export_author_keys [:id, :login, :nickname, :avatar]
  @export_article_keys [:id, :inner_id, :title, :digest, :upvotes_count, :article_stats]
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

      AbuseReports.List.paged_reports(%{
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
  def paged_reports(%{content_type: :comment, content_id: content_id} = filter) do
    with {:ok, info} <- match(:comment) do
      query =
        from(r in AbuseReport,
          where: field(r, ^info.foreign_key) == ^content_id,
          preload: [comment: ^@threads],
          preload: [comment: :author]
        )

      do_paged_reports(query, :comment, filter)
    end
  end

  @spec paged_reports(map()) :: T.domain_res(T.paged_data())
  def paged_reports(%{content_type: thread, content_id: content_id} = filter)
      when thread in @threads do
    with {:ok, info} <- match(thread) do
      query =
        from(r in AbuseReport,
          where: field(r, ^info.foreign_key) == ^content_id,
          preload: [^thread, :operate_user]
        )

      do_paged_reports(query, thread, filter)
    end
  end

  @spec paged_reports(map()) :: T.domain_res(T.paged_data())
  def paged_reports(%{content_type: thread} = filter) do
    with {:ok, info} <- match(thread) do
      query =
        from(r in AbuseReport,
          where: not is_nil(field(r, ^info.foreign_key)),
          preload: [^thread, :operate_user],
          preload: [comment: :author]
        )

      do_paged_reports(query, thread, filter)
    end
  end

  @spec paged_reports(map()) :: T.domain_res(T.paged_data())
  def paged_reports(filter) do
    query = from(r in AbuseReport, preload: [:operate_user])
    do_paged_reports(query, filter)
  end

  defp do_paged_reports(query, thread, filter) do
    %{page: page, size: size} = filter

    query
    |> QueryBuilder.filter_pack(filter)
    |> ORM.paginator(~m(page size)a)
    |> reports_formatter(thread)
    |> done()
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
    paged_reports
    |> Map.put(
      :entries,
      Enum.map(entries, fn report ->
        basic_report = report |> Map.take(@export_report_keys)
        basic_report |> Map.put(:comment, extract_article_comment_info(report))
      end)
    )
  end

  defp reports_formatter(%{entries: entries} = paged_reports, thread)
       when thread in @threads do
    stats = article_stats(entries, thread)

    paged_reports
    |> Map.put(
      :entries,
      Enum.map(entries, fn report ->
        basic_report = report |> Map.take(@export_report_keys)
        basic_report |> Map.put(:article, extract_article_info(thread, report, stats))
      end)
    )
  end

  defp extract_account_info(%AbuseReport{} = report) do
    report |> Map.get(:account) |> Map.take(@export_author_keys)
  end

  defp extract_article_info(thread, %AbuseReport{} = report, stats) do
    article = report |> Map.get(thread)

    article
    |> article_with_projection_count(thread, stats)
    |> Map.take(@export_article_keys)
    |> Map.merge(%{thread: thread})
  end

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

    article = extract_article_in_comment(report.comment)
    Map.merge(comment, %{article: article})
  end

  defp extract_article_in_comment(%Comment{} = comment) do
    thread =
      Enum.find(@threads, fn thread ->
        not is_nil(Map.get(comment, :"#{thread}_id"))
      end)

    case thread do
      nil ->
        %{thread: nil}

      _ ->
        comment
        |> Map.get(thread)
        |> article_with_projection_count(thread)
        |> Map.take(@export_article_keys)
        |> Map.merge(%{thread: thread})
    end
  end

  defp article_with_projection_count(article, thread),
    do: article_with_projection_count(article, thread, nil)

  defp article_with_projection_count(%{id: id} = article, thread, stats) do
    counts = CMS.Interactions.counts([article]) |> Map.get({thread, id}, %{})

    article_stats =
      case stats do
        nil ->
          CMS.FrontDesk.article_stats_for_articles(thread, [article])
          |> Map.get({thread, id}, %{})

        stats ->
          Map.get(stats, {thread, id}, %{})
      end

    article
    |> Map.put(:upvotes_count, Map.get(counts, :upvotes_count, 0))
    |> Map.put(:article_stats, article_stats)
  end

  defp article_with_projection_count(article, _thread, _summaries), do: article

  defp article_stats(entries, thread) do
    articles =
      entries
      |> Enum.map(&Map.get(&1, thread))
      |> Enum.reject(&is_nil/1)

    CMS.FrontDesk.article_stats_for_articles(thread, articles)
    |> case do
      stats when is_map(stats) -> stats
      _ -> %{}
    end
  end
end
