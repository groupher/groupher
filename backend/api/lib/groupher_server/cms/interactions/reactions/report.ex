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

  import Ecto.Query

  alias GroupherServer.{Accounts, CMS, Repo}

  alias Accounts.Model.User
  alias CMS.Articles.MutationLock
  alias CMS.Artiment.Matcher
  alias CMS.Comments.States, as: CommentStates

  alias CMS.Gate

  alias CMS.Interactions.{ErrorCat, ReadState}
  alias CMS.Interactions.Reactions.ReportConfirmation, as: Confirmation
  alias CMS.Command
  alias CMS.Model.{AbuseReport, Comment, Embeds}
  alias Helper.T

  @report_threshold_for_fold Comment.report_threshold_for_fold()

  @doc """
  Adds one report fact for the immutable reporter identity.

  ## Examples

      Reactions.Report.add(comment, "spam", %{}, actor, command_id)

  """
  @spec add(struct(), String.t(), term(), User.t(), Ecto.UUID.t()) :: T.domain_res(struct())
  def add(artiment, reason, attrs, %User{} = actor, command_id) do
    execute_command(
      artiment,
      actor,
      :report_add,
      %{reason: reason, attrs: attrs},
      command_id
    )
  end

  @doc """
  Removes the current reporter's fact idempotently.

  ## Examples

      Reactions.Report.remove(comment, actor, command_id)

  """
  @spec remove(struct(), User.t(), Ecto.UUID.t()) :: T.domain_res(struct())
  def remove(artiment, %User{} = actor, command_id) do
    execute_command(artiment, actor, :report_remove, %{}, command_id)
  end

  defp execute_command(input, actor, operation, params, command_id) do
    with {:ok, command_id} <- require_command_id(command_id) do
      %Command{
        actor: actor,
        command_id: command_id,
        operation: operation,
        target: input,
        params: params
      }
      |> Command.execute(action: &action/1, confirmation: Confirmation)
      |> present_result(input, actor)
    end
  end

  defp action(%{
         actor: actor,
         target: input,
         operation: operation,
         params: params,
         command_id: _command_id
       }) do
    result =
      with {:ok, canonical} <-
             mutate(input, actor, operation, params),
           {:ok, target_type} <- target_type(canonical) do
        {:ok,
         %Confirmation{
           data: %{
             "target_id" => to_string(canonical.id),
             "target_type" => target_type
           }
         }}
      end

    result
  end

  defp mutate(input, actor, :report_add, %{reason: reason, attrs: attrs}) do
    mutate(input, actor, fn canonical, info ->
      with {:ok, report} <- add_fact(info, canonical, reason, attrs, actor),
           {:ok, _projection} <- ReadState.add_report(canonical, actor),
           {:ok, _} <- maybe_fold_comment(canonical, report, actor) do
        canonical
      end
    end)
  end

  defp mutate(input, actor, :report_remove, _params) do
    mutate(input, actor, fn canonical, info ->
      with {:ok, changed?} <- remove_fact(info, canonical.id, actor),
           {:ok, _} <- maybe_remove_state(canonical, actor, changed?) do
        canonical
      end
    end)
  end

  defp mutate(input, actor, command) do
    MutationLock.observe_transaction(fn ->
      transaction = fn ->
        with {:ok, canonical} <- Gate.access_check(actor, :report, input),
             {:ok, info} <- Matcher.match_interaction(canonical),
             {:ok, result} <- normalize_command(command.(canonical, info)) do
          result
        else
          {:error, reason} -> Repo.rollback(reason)
        end
      end

      if Repo.in_transaction?() do
        case transaction.() do
          {:ok, _result} = result -> result
          {:error, _reason} = error -> error
          result -> {:ok, result}
        end
      else
        Repo.transaction(transaction)
      end
    end)
  end

  defp present_result({:ok, %Confirmation{}}, input, actor) do
    Gate.access_check(actor, :report, input)
  end

  defp present_result({:error, _reason} = error, _input, _actor), do: error

  defp require_command_id(command_id) when is_binary(command_id), do: {:ok, command_id}
  defp require_command_id(_command_id), do: {:error, CMS.ErrorCat.command_id_required()}

  defp target_type(%Comment{}), do: {:ok, "comment"}

  defp target_type(%{__struct__: module}),
    do: {:ok, module |> Module.split() |> List.last() |> Macro.underscore()}

  defp target_type(_target), do: {:error, ErrorCat.unsupported_artiment("report target")}

  defp normalize_command({:error, _reason} = error), do: error
  defp normalize_command(result), do: {:ok, result}

  defp maybe_remove_state(_canonical, _actor, false), do: {:ok, :pass}

  defp maybe_remove_state(canonical, actor, true) do
    case ReadState.remove_report(canonical, actor) do
      {:ok, _projection} -> {:ok, :pass}
      {:error, _reason} = error -> error
    end
  end

  defp maybe_fold_comment(%Comment{} = comment, report, _actor)
       when report.report_cases_count >= @report_threshold_for_fold do
    case CommentStates.fold_for_report(comment) do
      {:ok, _comment} -> {:ok, :pass}
      {:error, _reason} = error -> error
    end
  end

  defp maybe_fold_comment(_artiment, _report, _actor), do: {:ok, :pass}

  defp add_fact(info, canonical, reason, attrs, actor) do
    content_id = canonical.id

    with {:ok, report} <- load_report(info, content_id) do
      add_case(report, info, canonical, reason, attrs, actor)
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

  defp add_case(nil, info, canonical, reason, attrs, actor) do
    params =
      %{report_cases_count: 1, report_cases: [case_params(reason, attrs, actor)]}
      |> Map.put(info.foreign_key, canonical.id)
      |> maybe_put_community_id(canonical)

    %AbuseReport{}
    |> AbuseReport.changeset(params)
    |> Repo.insert()
  end

  defp add_case(%AbuseReport{} = report, _info, _canonical, reason, attrs, actor) do
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

  defp reported_by?(report, user_id) do
    Enum.any?(report.report_cases, &(reporter_user_id(&1) == user_id))
  end

  defp reporter_user_id(%{user: %{user_id: user_id}}), do: user_id
  defp reporter_user_id(_case), do: nil

  defp maybe_put_community_id(params, %{community: %{id: community_id}})
       when is_integer(community_id) do
    Map.put(params, :community_id, community_id)
  end

  defp maybe_put_community_id(params, %Comment{community_id: community_id})
       when is_integer(community_id) do
    Map.put(params, :community_id, community_id)
  end

  defp maybe_put_community_id(params, _canonical), do: params

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
