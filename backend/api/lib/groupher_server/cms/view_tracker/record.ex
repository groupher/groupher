defmodule GroupherServer.CMS.ViewTracker.Record do
  @moduledoc """
  Commits one Article view decision synchronously.

      public Article + trusted request identity
        -> physical Article key-share lock and Gate revalidation
        -> receipt claim
        -> watermark claim
        -> ArticleStats / ViewerState / MetricEvent
        -> finalized result in one transaction
  """

  import Ecto.Query

  alias GroupherServer.{CMS, Repo}
  alias GroupherServer.Analysis.MetricEvent
  alias CMS.Artiment.Matcher
  alias CMS.FrontDesk
  alias CMS.ViewTracker.{Config, ErrorCat, Identity, Policy}
  alias CMS.ViewTracker.Model.{ViewCountReceipt, ViewerState, ViewWatermark}

  @doc "Tracks one explicit Article read and returns its committed public/private state."
  @spec track(struct(), struct() | nil, Ecto.UUID.t() | nil, keyword()) ::
          {:ok, map()} | {:error, term()}
  def track(article, viewer, event_id, opts \\ []) do
    with {:ok, %{artiment: thread}} <- Matcher.match_interaction(article),
         true <- thread in CMS.Artiment.Threads.article_enums(),
         {:ok, event_id} <- normalize_event_id(event_id),
         {:ok, identity} <- Identity.resolve(viewer, opts),
         {:ok, decision} <- Policy.evaluate(identity, opts) do
      Repo.transaction(fn ->
        case FrontDesk.lock_article_for_view_tracking(article) do
          {:ok, locked, community, received_at} ->
            process(locked, community, thread, viewer, event_id, identity, decision, received_at)

          {:error, reason} ->
            Repo.rollback(reason)
        end
      end)
      |> transaction_result()
    else
      false -> {:error, ErrorCat.unsupported_artiment()}
      {:error, _reason} = error -> error
    end
  end

  @doc "Deletes all ViewTracker state for a physical Article after its row is deleted."
  @spec delete_article_state(atom(), pos_integer()) :: :ok
  def delete_article_state(thread, article_id) do
    delete_by_article(ViewCountReceipt, thread, article_id)
    delete_by_article(ViewWatermark, thread, article_id)
    delete_by_article(ViewerState, thread, article_id)
    CMS.ArticleStats.delete(thread, article_id)
  end

  defp process(article, community, thread, viewer, event_id, identity, decision, received_at) do
    if decision.counted do
      process_eligible(
        article,
        community,
        thread,
        viewer,
        event_id,
        identity,
        decision,
        received_at
      )
    else
      build_result(
        article,
        community,
        viewer,
        identity,
        %{
          thread: thread,
          event_id: event_id,
          counted: false,
          reason: :excluded_by_policy
        }
      )
    end
  end

  defp process_eligible(
         article,
         community,
         thread,
         viewer,
         event_id,
         identity,
         decision,
         received_at
       ) do
    attrs = receipt_attrs(event_id, thread, article.id, identity, received_at)

    case claim_receipt(attrs) do
      :owned ->
        counted = claim_watermark(thread, article.id, identity, received_at)
        reason = if counted, do: :counted, else: :duplicate_in_window

        stats =
          if counted do
            {:ok, committed_stats} = increment_views!(thread, article.id)
            :ok = project_viewer_state(identity, thread, article.id, received_at)
            :ok = append_metric!(event_id, article, identity, decision, received_at)
            committed_stats
          end

        :ok = finalize_receipt(event_id, counted, reason)

        build_result(
          article,
          community,
          viewer,
          identity,
          %{
            thread: thread,
            event_id: event_id,
            counted: counted,
            reason: reason,
            stats: stats
          }
        )

      :conflict ->
        replay_receipt(article, community, thread, viewer, identity, attrs)
    end
  end

  defp claim_receipt(attrs) do
    case Repo.insert_all(ViewCountReceipt, [attrs],
           on_conflict: :nothing,
           conflict_target: [:event_id],
           returning: [:event_id]
         ) do
      {1, _rows} -> :owned
      {0, _rows} -> :conflict
    end
  end

  defp replay_receipt(article, community, thread, viewer, identity, attrs) do
    case Repo.one(
           from(receipt in ViewCountReceipt,
             where: receipt.event_id == ^attrs.event_id,
             lock: "FOR UPDATE"
           )
         ) do
      %ViewCountReceipt{state: :finalized} = receipt ->
        if same_identity?(receipt, attrs) do
          build_result(
            article,
            community,
            viewer,
            identity,
            %{
              thread: thread,
              event_id: receipt.event_id,
              counted: receipt.counted,
              reason: receipt.decision_reason
            }
          )
        else
          Repo.rollback(ErrorCat.receipt_identity_mismatch())
        end

      %ViewCountReceipt{} ->
        Repo.rollback(ErrorCat.receipt_invalid_state())

      nil ->
        Repo.rollback(ErrorCat.receipt_invalid_state())
    end
  end

  defp claim_watermark(thread, article_id, identity, received_at) do
    cutoff =
      DateTime.add(
        received_at,
        -Config.dedupe_window_seconds(identity.actor_type),
        :second
      )

    attrs = %{
      thread: thread,
      article_id: article_id,
      viewer_tracking_key: identity.viewer_tracking_key,
      last_counted_at: received_at,
      inserted_at: received_at,
      updated_at: received_at
    }

    conflict_query =
      from(watermark in ViewWatermark,
        update: [set: [last_counted_at: ^received_at, updated_at: ^received_at]],
        where: watermark.last_counted_at <= ^cutoff
      )

    case Repo.insert_all(ViewWatermark, [attrs],
           on_conflict: conflict_query,
           conflict_target: [:thread, :article_id, :viewer_tracking_key],
           returning: [:article_id]
         ) do
      {1, _rows} -> true
      {0, _rows} -> false
    end
  end

  defp increment_views!(thread, article_id) do
    case CMS.ArticleStats.increment_views(thread, article_id) do
      {:ok, stats} -> {:ok, stats}
      {:error, reason} -> Repo.rollback(reason)
    end
  end

  defp project_viewer_state(
         %{actor_type: :human, is_authenticated: true, user_id: user_id},
         thread,
         article_id,
         received_at
       )
       when is_integer(user_id) do
    Repo.insert_all(
      ViewerState,
      [
        %{
          thread: thread,
          article_id: article_id,
          user_id: user_id,
          inserted_at: received_at
        }
      ],
      on_conflict: :nothing,
      conflict_target: [:thread, :article_id, :user_id]
    )

    :ok
  end

  defp project_viewer_state(_identity, _thread, _article_id, _received_at), do: :ok

  defp append_metric!(event_id, article, identity, decision, received_at) do
    case MetricEvent.append(%{
           operation_id: event_id,
           community_id: article.community_id,
           article_type: article_thread(article),
           article_id: article.id,
           metric: :article_view,
           value: 1,
           actor_type: identity.actor_type,
           is_authenticated: identity.is_authenticated,
           policy_version: decision.policy_version,
           occurred_at: received_at
         }) do
      :ok -> :ok
      {:error, reason} -> Repo.rollback(reason)
    end
  end

  defp finalize_receipt(event_id, counted, reason) do
    case Repo.update_all(
           from(receipt in ViewCountReceipt,
             where: receipt.event_id == ^event_id and receipt.state == :pending
           ),
           set: [state: :finalized, counted: counted, decision_reason: reason]
         ) do
      {1, _rows} -> :ok
      _ -> Repo.rollback(ErrorCat.receipt_invalid_state())
    end
  end

  defp build_result(article, community, viewer, identity, result) do
    %{thread: thread, event_id: event_id, counted: counted, reason: reason} = result
    committed_stats = Map.get(result, :stats)

    with {:ok, stats} <- resolve_stats(committed_stats, thread, article.id),
         viewer_state when is_map(viewer_state) <-
           CMS.ViewTracker.Query.viewer_state(article, viewer, actor_type: identity.actor_type) do
      %{
        counted: counted,
        decision_reason: reason,
        event_id: event_id,
        article_stats:
          Map.merge(stats, %{
            community: community.slug,
            inner_id: article.inner_id
          }),
        viewer_state:
          Map.merge(viewer_state, %{
            community: community.slug,
            thread: thread,
            inner_id: article.inner_id
          })
      }
    else
      {:error, :article_stats_not_found} -> Repo.rollback(ErrorCat.stats_not_found())
      {:error, reason} -> Repo.rollback(reason)
    end
  end

  defp resolve_stats(nil, thread, article_id), do: CMS.ArticleStats.fetch(thread, article_id)
  defp resolve_stats(stats, _thread, _article_id) when is_map(stats), do: {:ok, stats}

  defp receipt_attrs(event_id, thread, article_id, identity, received_at) do
    %{
      event_id: event_id,
      thread: thread,
      article_id: article_id,
      viewer_tracking_key: identity.viewer_tracking_key,
      state: :pending,
      counted: nil,
      decision_reason: nil,
      expires_at: DateTime.add(received_at, Config.view_count_receipt_ttl_seconds(), :second),
      inserted_at: received_at
    }
  end

  defp same_identity?(receipt, attrs) do
    receipt.thread == attrs.thread and
      receipt.article_id == attrs.article_id and
      receipt.viewer_tracking_key == attrs.viewer_tracking_key
  end

  defp article_thread(article) do
    {:ok, %{artiment: thread}} = Matcher.match_interaction(article)
    thread
  end

  defp delete_by_article(schema, thread, article_id) do
    Repo.delete_all(
      from(row in schema, where: row.thread == ^thread and row.article_id == ^article_id)
    )

    :ok
  end

  defp normalize_event_id(nil), do: {:ok, Ecto.UUID.generate()}

  defp normalize_event_id(event_id) do
    case Ecto.UUID.cast(event_id) do
      {:ok, event_id} -> {:ok, event_id}
      :error -> {:error, ErrorCat.invalid_event_id()}
    end
  end

  defp transaction_result({:ok, result}), do: {:ok, result}
  defp transaction_result({:error, reason}), do: {:error, reason}
end
