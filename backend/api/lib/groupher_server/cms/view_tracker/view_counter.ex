defmodule GroupherServer.CMS.ViewTracker.ViewCounter do
  @moduledoc """
  Atomically increments one Article view when its actor window has elapsed.

      Article + ViewTracker identity
        -> conditional ViewDedupeState UPSERT
        -> counted: ArticleStats.views + 1
        -> duplicate: current ArticleStats
  """

  import Ecto.Query

  alias GroupherServer.{CMS, Repo}
  alias CMS.Artiment.Matcher
  alias CMS.ViewTracker.{Config, Model.ViewDedupeState}

  @doc """
  Atomically counts a view when the actor/Article window has elapsed.

  A conditional PostgreSQL UPSERT both decides and advances the dedupe window,
  so concurrent requests for the same tracking key cannot both count. A
  counted result increments `ArticleStats`; a duplicate returns the current
  stats without incrementing. The caller must already be inside the tracking
  transaction and must supply a policy-admitted identity with a tracking key.
  """
  @spec increment_if_needed(struct(), map(), DateTime.t()) ::
          {:counted, map()} | {:duplicate, map()} | {:error, term()}
  def increment_if_needed(article, identity, received_at) do
    with {:ok, %{artiment: thread}} <- Matcher.match_interaction(article),
         counted? <- advance_dedupe_state(thread, article.id, identity, received_at),
         {:ok, stats} <- current_stats(counted?, thread, article.id) do
      if counted?, do: {:counted, stats}, else: {:duplicate, stats}
    end
  end

  defp advance_dedupe_state(thread, article_id, identity, received_at) do
    window_seconds = Config.dedupe_window_seconds(identity.actor_type)
    cutoff = DateTime.add(received_at, -window_seconds, :second)

    expires_at =
      DateTime.add(received_at, Config.dedupe_state_ttl_seconds(identity.actor_type), :second)

    attrs = %{
      thread: thread,
      article_id: article_id,
      viewer_tracking_key: identity.viewer_tracking_key,
      last_counted_at: received_at,
      expires_at: expires_at,
      inserted_at: received_at,
      updated_at: received_at
    }

    conflict_query =
      from(state in ViewDedupeState,
        update: [
          set: [
            last_counted_at: ^received_at,
            expires_at: ^expires_at,
            updated_at: ^received_at
          ]
        ],
        where: state.last_counted_at <= ^cutoff
      )

    case Repo.insert_all(ViewDedupeState, [attrs],
           on_conflict: conflict_query,
           conflict_target: [:thread, :article_id, :viewer_tracking_key],
           returning: [:article_id]
         ) do
      {1, _rows} -> true
      {0, _rows} -> false
    end
  end

  defp current_stats(true, thread, article_id) do
    CMS.ArticleStats.increment_views(thread, article_id)
  end

  defp current_stats(false, thread, article_id), do: CMS.ArticleStats.fetch(thread, article_id)
end
