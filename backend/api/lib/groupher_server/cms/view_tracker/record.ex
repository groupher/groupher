defmodule GroupherServer.CMS.ViewTracker.Record do
  @moduledoc """
  Commits one Article view synchronously.

      public Article + request-scoped classification
        -> physical Article key-share lock and Gate revalidation
        -> Policy.allowed?/2
        -> ViewCounter.increment_if_needed/3
        -> ArticleStats / ViewerState / MetricEvent
  """

  import Ecto.Query

  alias Ecto.UUID
  alias GroupherServer.{Analysis, CMS, Repo, RequestActor}
  alias Analysis.MetricEvent
  alias RequestActor.Classification
  alias CMS.Artiment.{Matcher, Threads}
  alias CMS.Articles.ErrorCat, as: ArticleErrorCat
  alias CMS.Articles.Bindings
  alias CMS.FrontDesk.Article, as: ArticleFrontDesk
  alias CMS.Model.{Article, ArticleBinding, Community}
  alias CMS.ViewTracker.{ErrorCat, Identity, Policy, ViewCounter}
  alias CMS.ViewTracker.Model.{ViewDedupeState, ViewerState}

  @telemetry_event [:groupher, :cms, :view_tracker, :track]

  @doc """
  Commits one explicit Article read and returns the resulting public/private state.

  The operation runs in one transaction: it locks and revalidates the physical
  Article through Gate, applies policy, atomically advances dedupe state, and
  writes the counter, authenticated viewer projection, and analytics event.
  Policy-excluded traffic returns `tracked: false` without writing view state.
  Any write/readback failure rolls the transaction back.
  """
  @spec track(struct(), struct() | nil, Classification.t(), keyword()) ::
          {:ok, map()} | {:error, term()}
  def track(article, viewer, classification, opts \\ [])

  def track(article, viewer, %Classification{} = classification, opts) do
    with {:ok, %{artiment: thread}} <- Matcher.match_interaction(article),
         true <- thread in Threads.article_enums(),
         {:ok, read_purpose} <- read_purpose(opts),
         {:ok, identity} <- Identity.resolve(viewer, classification, opts) do
      Repo.transaction(fn ->
        case lock_article_for_view_tracking(article) do
          {:ok, locked, community, received_at} ->
            process(locked, community, thread, viewer, identity, read_purpose, received_at)

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

  def track(_article, _viewer, _classification, _opts) do
    {:error, ErrorCat.invalid_actor_type()}
  end

  @doc """
  Deletes all view-owned state for a permanently deleted physical Article.

  The caller owns lifecycle admission and transaction placement. This function
  removes dedupe state, authenticated viewer state, and the shared public stats
  projection for the exact `{thread, article_id}`; it does not delete another
  branch or logical Article identity.
  """
  @spec delete_article_state(atom(), pos_integer()) :: {:ok, :pass}
  def delete_article_state(thread, article_id) do
    delete_by_article(ViewDedupeState, thread, article_id)
    delete_by_article(ViewerState, thread, article_id)
    CMS.ArticleStats.delete(thread, article_id)
  end

  defp process(article, community, thread, viewer, identity, read_purpose, received_at) do
    if Policy.allowed?(identity, read_purpose) do
      case ViewCounter.increment_if_needed(article, identity, received_at) do
        {:counted, stats} ->
          operation_id = UUID.generate()
          {:ok, _} = project_viewer_state(identity, thread, article.id, received_at)
          {:ok, _} = append_metric!(operation_id, article, community, identity, received_at)
          emit_outcome(:counted, identity)
          build_result(article, community, thread, viewer, identity, true, stats)

        {:duplicate, stats} ->
          emit_outcome(:duplicate_in_window, identity)
          build_result(article, community, thread, viewer, identity, true, stats)

        {:error, reason} ->
          Repo.rollback(reason)
      end
    else
      emit_outcome(:excluded_by_policy, identity)
      build_result(article, community, thread, viewer, identity, false, nil)
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

    {:ok, :pass}
  end

  defp project_viewer_state(_identity, _thread, _article_id, _received_at), do: {:ok, :pass}

  defp append_metric!(operation_id, article, community, identity, received_at) do
    case MetricEvent.append(%{
           operation_id: operation_id,
           community_id: community.id,
           article_type: article_thread(article),
           article_id: article.id,
           metric: :article_view,
           value: 1,
           actor_type: identity.actor_type,
           is_authenticated: identity.is_authenticated,
           policy_version: Policy.version(),
           occurred_at: received_at
         }) do
      {:ok, _} -> {:ok, :pass}
      {:error, reason} -> Repo.rollback(reason)
    end
  end

  defp build_result(article, community, thread, viewer, identity, tracked, committed_stats) do
    with {:ok, %{inner_id: inner_id}} <-
           Bindings.get(%{article_id: article.id}, community),
         {:ok, stats} <- resolve_stats(committed_stats, thread, article.id),
         viewer_state when is_map(viewer_state) <-
           CMS.ViewTracker.Query.viewer_state(article, viewer, actor_type: identity.actor_type) do
      %{
        tracked: tracked,
        article_stats:
          Map.merge(stats, %{
            community: community.slug,
            inner_id: inner_id
          }),
        viewer_state:
          Map.merge(viewer_state, %{
            community: community.slug,
            thread: thread,
            inner_id: inner_id
          })
      }
    else
      {:error, :article_stats_not_found} -> Repo.rollback(ErrorCat.stats_not_found())
      {:error, reason} -> Repo.rollback(reason)
    end
  end

  defp resolve_stats(nil, thread, article_id), do: CMS.ArticleStats.fetch(thread, article_id)
  defp resolve_stats(stats, _thread, _article_id) when is_map(stats), do: {:ok, stats}

  defp article_thread(article) do
    {:ok, %{artiment: thread}} = Matcher.match_interaction(article)
    thread
  end

  defp delete_by_article(schema, thread, article_id) do
    Repo.delete_all(
      from(row in schema, where: row.thread == ^thread and row.article_id == ^article_id)
    )

    {:ok, :pass}
  end

  defp read_purpose(opts) do
    case Keyword.fetch(opts, :read_purpose) do
      {:ok, purpose}
      when purpose in [
             :public_read,
             :author_preview,
             :moderation_review,
             :operations_inspection,
             :internal_probe
           ] ->
        {:ok, purpose}

      {:ok, _purpose} ->
        {:error, ErrorCat.invalid_read_purpose()}

      :error ->
        {:error, ErrorCat.missing_read_purpose()}
    end
  end

  defp emit_outcome(outcome, identity) do
    :telemetry.execute(
      @telemetry_event,
      %{count: 1},
      %{
        outcome: outcome,
        actor_type: identity.actor_type,
        actor_confidence: identity.actor_confidence,
        classified_by: identity.classified_by
      }
    )
  end

  defp transaction_result({:ok, result}), do: {:ok, result}
  defp transaction_result({:error, reason}), do: {:error, reason}

  defp lock_article_for_view_tracking(%{id: article_id, thread: thread} = projection)
       when is_binary(article_id) and thread in [:post, :blog, :changelog, :doc] do
    received_at = DateTime.utc_now(:second)

    with %Article{} = locked <-
           Article
           |> where([article], article.id == ^article_id)
           |> lock("FOR KEY SHARE")
           |> Repo.one(),
         %Community{} = community <- projection_community(projection),
         %ArticleBinding{inner_id: inner_id} <-
           Repo.get_by(ArticleBinding, article_id: locked.id, community_id: community.id),
         {:ok, current} <- ArticleFrontDesk.read_stable(community, thread, inner_id, nil, []) do
      {:ok, Map.merge(current, Map.take(projection, [:branch_id])), community, received_at}
    else
      _ -> {:error, ArticleErrorCat.article_not_found("article not found")}
    end
  end

  defp lock_article_for_view_tracking(_projection) do
    {:error, ArticleErrorCat.article_not_found("article not found")}
  end

  defp projection_community(%{community: %Community{} = community}), do: community
  defp projection_community(_projection), do: nil
end
