defmodule GroupherServer.CMS.Review.Threshold do
  @moduledoc """
  Applies the report-count visibility restriction from a locked current target.

      SubmitReport transaction
        -> Review.Threshold
          -> Review.Restrictions
  """

  alias GroupherServer.{AlertWall, CMS, Repo}
  alias CMS.Model.DocBranch

  @doc "Applies a report threshold hold atomically with the report that crosses it."
  def apply_report_in_transaction(%{owner: :cms} = report)
      when is_integer(report.item_id) and is_integer(report.observed_version) do
    scope_key =
      if is_nil(report.community_id), do: "platform", else: "community:#{report.community_id}"

    with true <- Repo.in_transaction?(),
         {:ok, context} <- load_context(report, scope_key),
         count <- AlertWall.active_reporter_count(report.item_id, report.observed_version),
         {:ok, :pass} <- maybe_apply(context, report, count) do
      {:ok, :pass}
    else
      false -> {:error, CMS.ErrorCat.review_transition_requires_transaction()}
      {:error, _reason} = error -> error
      _ -> {:error, CMS.ErrorCat.invalid_review_block()}
    end
  end

  def apply_report_in_transaction(_report), do: {:ok, :pass}

  defp load_context(%{target_type: :comment} = report, _report_community_scope) do
    with {:ok, context} <-
           CMS.Review.load_for_update("comment:#{report.target_id}", "platform") do
      case context.target do
        %{thread: :doc, branch_id: branch_id} when is_integer(branch_id) ->
          case Repo.get(DocBranch, branch_id) do
            %DocBranch{community_id: community_id} ->
              {:ok, %{context | scope_key: "community:#{community_id}"}}

            _ ->
              {:error, CMS.ErrorCat.invalid_review_block()}
          end

        %{thread: thread} when thread in [:post, :blog, :changelog] ->
          {:ok, context}

        _ ->
          {:error, CMS.ErrorCat.invalid_review_block()}
      end
    end
  end

  defp load_context(report, scope_key) do
    CMS.Review.load_for_update("#{report.target_type}:#{report.target_id}", scope_key)
  end

  defp maybe_apply(context, report, count) do
    threshold = CMS.Review.Config.report_threshold()

    if count < threshold do
      {:ok, :pass}
    else
      apply_hold(context, report)
    end
  end

  defp apply_hold(context, report) do
    CMS.Review.Restrictions.apply(context.lifecycle, %{
      scope_key: context.scope_key,
      type: :report_threshold_hold,
      source: :domain,
      source_ref: "report_threshold:item:#{report.item_id}",
      operation_ref: report.operation_ref,
      applied_at: DateTime.utc_now(:second)
    })
    |> case do
      {:ok, _restriction} -> {:ok, :pass}
      {:error, _reason} = error -> error
    end
  end
end
