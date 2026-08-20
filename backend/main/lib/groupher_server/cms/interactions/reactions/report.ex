defmodule GroupherServer.CMS.Interactions.Reactions.Report do
  @moduledoc """
  Owns the complete Article and Comment report flow.

      CMS.Interactions
        -> Gate canonical Artiment and aggregate MutationLock
        -> AbuseReport embedded fact keyed by immutable reporter user id
        -> Interaction State in the same transaction

  Account reports intentionally remain in `CMS.AbuseReports`; their reported
  meta is a separate account moderation mechanism.
  """

  alias GroupherServer.{CMS, Repo}
  alias GroupherServer.Accounts.Model.User
  alias CMS.Artiment.Matcher
  alias CMS.Articles.MutationLock
  alias GroupherServer.Repo
  import Ecto.Query

  alias CMS.Interactions.{ErrorCat, ReadState}
  alias CMS.Model.{AbuseReport, Comment, Embeds}
  alias CMS.{Gate}
  alias Helper.T

  @report_threshold_for_fold Comment.report_threshold_for_fold()

  @doc """
  Adds one report fact for the immutable reporter identity.

  ## Examples

      Reactions.Report.add(comment, "spam", %{}, actor)

  """
  @spec add(struct(), String.t(), term(), User.t()) :: T.domain_res(struct())
  def add(artiment, reason, attrs, %User{} = actor) do
    mutate(artiment, actor, fn canonical, info ->
      with {:ok, report} <- add_fact(info, canonical.id, reason, attrs, actor),
           {:ok, _projection} <- ReadState.add_report(canonical, actor),
           :ok <- maybe_fold_comment(canonical, report, actor) do
        canonical
      end
    end)
  end

  @doc """
  Removes the current reporter's fact idempotently.

  ## Examples

      Reactions.Report.remove(comment, actor)

  """
  @spec remove(struct(), User.t()) :: T.domain_res(struct())
  def remove(artiment, %User{} = actor) do
    mutate(artiment, actor, fn canonical, info ->
      with {:ok, changed?} <- remove_fact(info, canonical.id, actor),
           :ok <- maybe_remove_state(canonical, actor, changed?) do
        canonical
      end
    end)
  end

  defp mutate(input, actor, command) do
    MutationLock.observe_transaction(fn ->
      Repo.transaction(fn ->
        with {:ok, canonical} <- Gate.access_check(actor, :report, input),
             {:ok, info} <- Matcher.match_interaction(canonical),
             {:ok, result} <- normalize_command(command.(canonical, info)) do
          result
        else
          {:error, reason} -> Repo.rollback(reason)
        end
      end)
    end)
  end

  defp normalize_command({:error, _reason} = error), do: error
  defp normalize_command(result), do: {:ok, result}

  defp maybe_remove_state(_canonical, _actor, false), do: :ok

  defp maybe_remove_state(canonical, actor, true) do
    case ReadState.remove_report(canonical, actor) do
      {:ok, _projection} -> :ok
      {:error, _reason} = error -> error
    end
  end

  defp maybe_fold_comment(%Comment{} = comment, report, _actor)
       when report.report_cases_count >= @report_threshold_for_fold do
    case CommentStates.fold_for_report(comment) do
      {:ok, _comment} -> :ok
      {:error, _reason} = error -> error
    end
  end

  defp maybe_fold_comment(_artiment, _report, _actor), do: :ok

  defp add_fact(info, content_id, reason, attrs, actor) do
    with {:ok, report} <- load_report(info, content_id) do
      add_case(report, info, content_id, reason, attrs, actor)
    end
  end

  defp remove_fact(info, content_id, actor) do
    with {:ok, report} <- load_report(info, content_id) do
      remove_case(report, actor)
    end
  end

  defp load_report(info, content_id) do
    from(report in AbuseReport,
      where: field(report, ^info.foreign_key) == ^content_id,
      lock: "FOR UPDATE",
      limit: 2
    )
    |> Repo.all()
    |> case do
      [] -> {:ok, nil}
      [report] -> {:ok, report}
      _ -> {:error, ErrorCat.interaction_state_conflict("multiple AbuseReport facts")}
    end
  end

  defp add_case(nil, info, content_id, reason, attrs, actor) do
    params =
      %{report_cases_count: 1, report_cases: [case_params(reason, attrs, actor)]}
      |> Map.put(info.foreign_key, content_id)

    %AbuseReport{}
    |> AbuseReport.changeset(params)
    |> Repo.insert()
  end

  defp add_case(%AbuseReport{} = report, _info, _content_id, reason, attrs, actor) do
    if reported_by?(report, actor.id) do
      {:error, ErrorCat.already_reported("user #{actor.id} already reported")}
    else
      cases = report.report_cases ++ [case_struct(reason, attrs, actor)]

      report
      |> Ecto.Changeset.change(report_cases_count: length(cases))
      |> Ecto.Changeset.put_embed(:report_cases, cases)
      |> Repo.update()
    end
  end

  defp remove_case(nil, _actor), do: {:ok, false}

  defp remove_case(%AbuseReport{} = report, actor) do
    if reported_by?(report, actor.id) do
      cases = Enum.reject(report.report_cases, &(reporter_user_id(&1) == actor.id))

      case cases do
        [] ->
          case Repo.delete(report) do
            {:ok, _report} -> {:ok, true}
            {:error, _changeset} = error -> error
          end

        _ ->
          report
          |> Ecto.Changeset.change(report_cases_count: length(cases))
          |> Ecto.Changeset.put_embed(:report_cases, cases)
          |> Repo.update()
          |> case do
            {:ok, _report} -> {:ok, true}
            {:error, _changeset} = error -> error
          end
      end
    else
      {:ok, false}
    end
  end

  defp reported_by?(report, user_id),
    do: Enum.any?(report.report_cases, &(reporter_user_id(&1) == user_id))

  defp reporter_user_id(%{user: %{user_id: user_id}}), do: user_id
  defp reporter_user_id(_case), do: nil

  defp case_params(reason, attrs, actor) do
    %{
      reason: reason,
      attr: attrs,
      user: actor |> Embeds.User.from_account_user() |> Map.from_struct()
    }
  end

  defp case_struct(reason, attrs, actor) do
    user = actor |> Embeds.User.from_account_user() |> Map.from_struct()
    %Embeds.AbuseReportCase{reason: reason, attr: attrs, user: user}
  end
end
