defmodule GroupherServer.CMS.AbuseReports.Report do
  @moduledoc """
  Abuse report operations.
  """
  import Ecto.Query, warn: false
  import Helper.Utils, only: [done: 1, strip_struct: 1]
  import GroupherServer.CMS.Helper.Matcher

  alias Helper.{ORM, Transaction}
  alias Helper.Types, as: T
  alias GroupherServer.{Accounts, CMS, Repo}
  alias CMS.FrontDesk

  alias Accounts.Model.User
  alias CMS.Model.{AbuseReport, Comment, Embeds}

  alias Ecto.Multi

  @report_threshold_for_fold Comment.report_threshold_for_fold()

  @spec account(User.t(), String.t(), map(), User.t()) :: T.domain_res(User.t())
  def account(%User{} = target_account, reason, attr, %User{} = user) do
    {:ok, info} = match(:account)

    Transaction.locking(target_account, fn account ->
      Multi.new()
      |> Multi.run(:create_abuse_report, fn _, _ ->
        create_report(:account, account.id, reason, attr, user)
      end)
      |> Multi.run(:update_report_meta, fn _, _ ->
        update_report_meta(info, account)
      end)
      |> Repo.transaction()
      |> result()
    end)
  end

  @spec undo_account(User.t(), User.t()) :: T.domain_res(User.t())
  def undo_account(%User{} = target_account, %User{} = user) do
    {:ok, info} = match(:account)

    Transaction.locking(target_account, fn account ->
      Multi.new()
      |> Multi.run(:delete_abuse_report, fn _, _ ->
        delete_report(:account, account.id, user)
      end)
      |> Multi.run(:update_report_meta, fn _, _ ->
        update_report_meta(info, account)
      end)
      |> Repo.transaction()
      |> result()
    end)
  end

  @spec article(T.article(), String.t(), map(), User.t()) :: T.domain_res(T.article())
  def article(target_article, reason, attr, %User{} = user) do
    {:ok, info} = match(target_article)

    Transaction.locking(target_article, fn article ->
      Multi.new()
      |> Multi.run(:create_abuse_report, fn _, _ ->
        {:ok, thread} = FrontDesk.thread_of(article)
        create_report(thread, article.id, reason, attr, user)
      end)
      |> Multi.run(:update_report_meta, fn _, _ ->
        update_report_meta(info, article)
      end)
      |> Repo.transaction()
      |> result()
    end)
  end

  @spec undo_article(T.article(), User.t()) :: T.domain_res(T.article())
  def undo_article(target_article, %User{} = user) do
    {:ok, thread} = FrontDesk.thread_of(target_article)
    {:ok, info} = match(thread)

    Transaction.locking(target_article, fn article ->
      Multi.new()
      |> Multi.run(:delete_abuse_report, fn _, _ ->
        delete_report(thread, article.id, user)
      end)
      |> Multi.run(:update_report_meta, fn _, _ ->
        update_report_meta(info, article)
      end)
      |> Repo.transaction()
      |> result()
    end)
  end

  @spec comment(Comment.t(), String.t(), map(), User.t()) :: T.domain_res(Comment.t())
  def comment(%Comment{} = target_comment, reason, attr, %User{} = user) do
    Transaction.locking(target_comment, fn comment ->
      Multi.new()
      |> Multi.run(:create_abuse_report, fn _, _ ->
        create_report(:comment, comment.id, reason, attr, user)
      end)
      |> Multi.run(:update_report_meta, fn _, _ ->
        {:ok, info} = match(:comment)
        update_report_meta(info, comment)
      end)
      |> Multi.run(:fold_comment_report_too_many, fn _, %{create_abuse_report: abuse_report} ->
        if abuse_report.report_cases_count >= @report_threshold_for_fold,
          do: CMS.Comments.fold_comment(comment.id, user),
          else: {:ok, comment}
      end)
      |> Multi.run(:sync_embed_replies, fn _, %{update_report_meta: comment} ->
        FrontDesk.sync_embed_replies(comment)
      end)
      |> Repo.transaction()
      |> result()
    end)
  end

  @spec undo_comment(Comment.t(), User.t()) :: T.domain_res(Comment.t())
  def undo_comment(%Comment{} = target_comment, %User{} = user) do
    Transaction.locking(target_comment, fn comment ->
      Multi.new()
      |> Multi.run(:delete_abuse_report, fn _, _ ->
        delete_report(:comment, comment.id, user)
      end)
      |> Multi.run(:update_report_meta, fn _, _ ->
        {:ok, info} = match(:comment)
        update_report_meta(info, comment)
      end)
      |> Repo.transaction()
      |> result()
    end)
  end

  defp create_report(type, content_id, reason, attr, %User{} = user) do
    with {:ok, info} <- match(type),
         {:ok, report} <- not_reported_before(info, content_id, user) do
      case report do
        nil ->
          report_cases = [
            %{
              reason: reason,
              attr: attr,
              user: %{user_id: user.id, login: user.login, nickname: user.nickname}
            }
          ]

          args =
            %{report_cases_count: 1, report_cases: report_cases}
            |> Map.put(info.foreign_key, content_id)

          AbuseReport |> ORM.create(args)

        _ ->
          report_user = %{user_id: user.id, login: user.login, nickname: user.nickname}

          report_cases =
            report.report_cases
            |> List.insert_at(
              length(report.report_cases),
              %Embeds.AbuseReportCase{reason: reason, attr: attr, user: report_user}
            )

          report
          |> Ecto.Changeset.change(%{report_cases_count: length(report_cases)})
          |> Ecto.Changeset.put_embed(:report_cases, report_cases)
          |> Repo.update()
      end
    end
  end

  defp delete_report(thread, content_id, %User{} = user) do
    with {:ok, info} <- match(thread),
         {:error, _} <- not_reported_before(info, content_id, user),
         {:ok, report} <- ORM.find_by(AbuseReport, Map.put(%{}, info.foreign_key, content_id)) do
      case length(report.report_cases) do
        1 ->
          ORM.delete(report)

        _ ->
          report_cases = report.report_cases |> Enum.reject(&(&1.user.login == user.login))
          changes = %{report_cases_count: length(report_cases)}

          report
          |> ORM.update_embed(:report_cases, report_cases, changes)
      end
    end
  end

  defp update_report_meta(info, content) do
    meta =
      case ORM.find_by(AbuseReport, Map.put(%{}, info.foreign_key, content.id)) do
        {:ok, record} ->
          report_cases = record.report_cases
          reported_count = length(report_cases)
          safe_meta = if is_nil(content.meta), do: info.default_meta, else: content.meta
          reported_user_ids = report_cases |> Enum.map(& &1.user.user_id)

          safe_meta
          |> Map.merge(%{reported_count: reported_count, reported_user_ids: reported_user_ids})
          |> strip_struct

        {:error, _} ->
          safe_meta = if is_nil(content.meta), do: info.default_meta, else: content.meta

          safe_meta |> Map.merge(%{reported_count: 0, reported_user_ids: []}) |> strip_struct
      end

    content |> ORM.update_meta(meta)
  end

  defp not_reported_before(info, content_id, %User{login: login}) do
    query = from(r in AbuseReport, where: field(r, ^info.foreign_key) == ^content_id)

    report = Repo.one(query)

    case report do
      nil ->
        {:ok, nil}

      _ ->
        reported_before =
          report.report_cases
          |> Enum.filter(fn item -> item.user.login == login end)
          |> length
          |> Kernel.>(0)

        if not reported_before,
          do: {:ok, report},
          else: {:error, {:already_exist, "#{login} already reported"}}
    end
  end

  defp result({:ok, %{sync_embed_replies: result}}), do: result |> done()
  defp result({:ok, %{update_report_meta: result}}), do: result |> done()
  defp result({:ok, %{update_content_reported_flag: result}}), do: result |> done()

  defp result({:error, _, result, _steps}) do
    {:error, result}
  end
end
