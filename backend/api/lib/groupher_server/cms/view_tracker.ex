defmodule GroupherServer.CMS.ViewTracker do
  @moduledoc """
  Article effective-view owner.

      Article Reader -> ViewTracker -> durable ViewEvent -> projector
      Article response -> ViewTracker.viewer_states/2
  """

  alias __MODULE__.{Maintenance, Project, Record, Query}
  alias GroupherServer.Accounts.Model.User

  @doc "Records one Article view decision and schedules its durable projection."
  @spec track(struct(), User.t() | nil, Ecto.UUID.t() | nil, keyword()) ::
          {:ok, Ecto.UUID.t()} | {:error, term()}
  defdelegate track(article, viewer, event_id, opts \\ []), to: Record

  @doc "Returns viewer state for one Article. Anonymous viewers always receive false in V1."
  @spec viewer_state(struct(), User.t() | nil, keyword()) :: map() | {:error, term()}
  defdelegate viewer_state(article, viewer, opts \\ []), to: Query

  @doc "Returns batched viewer state keyed by `{thread, article_id}`."
  @spec viewer_states([struct()], User.t() | nil, keyword()) :: map() | {:error, term()}
  defdelegate viewer_states(articles, viewer, opts \\ []), to: Query

  @doc "Returns current views for already-authorized canonical Articles in one thread."
  @spec summaries(atom(), [struct()]) :: map() | {:error, term()}
  defdelegate summaries(thread, articles), to: Query

  @doc "Projects pending counted views for one Article event."
  @spec project(Ecto.UUID.t(), pos_integer() | nil) :: :ok | {:error, term()}
  defdelegate project(event_id, generation \\ nil), to: Project

  @doc "Records a projection failure for retry telemetry."
  @spec record_failure(Ecto.UUID.t(), term(), pos_integer() | nil) :: :ok
  defdelegate record_failure(event_id, reason, generation \\ nil), to: Project

  @doc "Registers the current Oban projection job for one event generation."
  defdelegate register_projection_job(event_id, generation, job_id), to: Project

  @doc "Marks a failed final projection as dead-letter when it is still current."
  defdelegate dead_letter(event_id, generation, reason), to: Project

  @doc "Reopens a dead-letter projection as a new generation."
  defdelegate replay(event_id), to: Project

  @doc "Resolves a dead-letter projection as permanently dropped."
  defdelegate resolve_as_dropped(event_id), to: Project

  @doc "Cleans current Article view projections during permanent Article deletion."
  defdelegate delete_article_projection(thread, article_id), to: Project

  @doc "Classifies expired pending projections with no active current Oban job as dead-letter."
  defdelegate reconcile_dead_letters(limit \\ 100), to: Maintenance

  @doc "Deletes completed ViewEvents past the configured retention window."
  @spec delete_expired() :: non_neg_integer()
  defdelegate delete_expired(), to: Maintenance

  @doc "Returns ViewTracker operational metrics."
  @spec metrics() :: map()
  defdelegate metrics(), to: Maintenance

  @doc "Samples recent projected human views without repairing state."
  defdelegate sample_consistency(limit \\ 100), to: Maintenance
end
