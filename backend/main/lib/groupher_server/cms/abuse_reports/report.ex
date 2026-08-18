defmodule GroupherServer.CMS.AbuseReports.Report do
  @moduledoc """
  Abuse report operations.

  Business position:

      GraphQL resolver / job
        -> CMS facade
        -> Report
        -> Repo / external boundary
  """
  import Ecto.Query, warn: false
  import Helper.Utils, only: [done: 1, strip_struct: 1]
  import GroupherServer.CMS.Artiment.Matcher

  alias GroupherServer.{Accounts, Repo}
  alias GroupherServer.CMS.Interactions.ErrorCat
  alias Helper.{Multi, ORM, T, Transaction}

  alias Accounts.Model.User
  alias GroupherServer.CMS.Model.{AbuseReport, Embeds}

  @doc """
  Files an abuse report against one user account.

  Creates or appends a report case and refreshes the account's reported meta
  in one transaction.

  ## Examples

      CMS.AbuseReports.Report.account(target_account, "spam", %{}, user)

  """
  @spec account(User.t(), String.t(), map(), User.t()) :: T.domain_res(User.t())
  def account(%User{} = target_account, reason, attr, %User{} = user) do
    {:ok, info} = match(:account)

    Transaction.lock_row(target_account, fn account ->
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

    Transaction.lock_row(target_account, fn account ->
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

  defp create_report(type, content_id, reason, attr, %User{} = user) do
    with {:ok, info} <- match(type),
         {:ok, report} <- not_reported_before(info, content_id, user) do
      case report do
        nil ->
          report_cases = [
            %{
              reason: reason,
              attr: attr,
              user: Embeds.User.from_account_user(user) |> Map.from_struct()
            }
          ]

          args =
            %{report_cases_count: 1, report_cases: report_cases}
            |> Map.put(info.foreign_key, content_id)

          AbuseReport |> ORM.create(args)

        _ ->
          report_user = Embeds.User.from_account_user(user) |> Map.from_struct()

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
          else: {:error, ErrorCat.already_reported("#{login} already reported")}
    end
  end

  defp result({:ok, %{update_report_meta: result}}), do: result |> done()
  defp result({:ok, %{update_content_reported_flag: result}}), do: result |> done()

  defp result({:error, _, result, _steps}) do
    {:error, result}
  end
end
