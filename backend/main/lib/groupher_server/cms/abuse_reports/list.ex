defmodule GroupherServer.CMS.AbuseReports.List do
  @moduledoc """
  List operations for abuse reports.
  """
  import Ecto.Query, warn: false
  import GroupherServer.CMS.Helper.Matcher
  import ShortMaps

  alias Helper.{ORM, QueryBuilder}
  alias Helper.Types, as: T
  alias GroupherServer.CMS
  alias CMS.Model.{AbuseReport, Comment}

  import Helper.Utils, only: [done: 1, get_config: 2]

  @article_threads get_config(:article, :threads)

  @export_author_keys [:id, :login, :nickname, :avatar]
  @export_article_keys [:id, :title, :digest, :upvotes_count, :views]
  @export_report_keys [
    :id,
    :deal_with,
    :operate_user,
    :report_cases,
    :report_cases_count,
    :inserted_at,
    :updated_at
  ]

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
          preload: [comment: ^@article_threads],
          preload: [comment: :author]
        )

      do_paged_reports(query, :comment, filter)
    end
  end

  @spec paged_reports(map()) :: T.domain_res(T.paged_data())
  def paged_reports(%{content_type: thread, content_id: content_id} = filter)
      when thread in @article_threads do
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
       when thread in @article_threads do
    paged_reports
    |> Map.put(
      :entries,
      Enum.map(entries, fn report ->
        basic_report = report |> Map.take(@export_report_keys)
        basic_report |> Map.put(:article, extract_article_info(thread, report))
      end)
    )
  end

  defp extract_account_info(%AbuseReport{} = report) do
    report |> Map.get(:account) |> Map.take(@export_author_keys)
  end

  defp extract_article_info(thread, %AbuseReport{} = report) do
    report
    |> Map.get(thread)
    |> Map.take(@export_article_keys)
    |> Map.merge(%{thread: thread |> to_string |> String.upcase()})
  end

  defp extract_article_comment_info(%AbuseReport{} = report) do
    keys = [:id, :upvotes_count, :body_html]
    author = Map.take(report.comment.author, @export_author_keys)

    comment = Map.take(report.comment, keys)
    comment = Map.merge(comment, %{author: author})

    article = extract_article_in_comment(report.comment)
    Map.merge(comment, %{article: article})
  end

  defp extract_article_in_comment(%Comment{} = comment) do
    article_thread =
      Enum.find(@article_threads, fn thread ->
        not is_nil(Map.get(comment, :"#{thread}_id"))
      end)

    case article_thread do
      nil ->
        %{thread: nil}

      _ ->
        comment
        |> Map.get(article_thread)
        |> Map.take(@export_article_keys)
        |> Map.merge(%{thread: article_thread})
    end
  end
end
