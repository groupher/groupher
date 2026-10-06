defmodule GroupherServer.CMS.ViewTracker do
  @moduledoc """
  Synchronous Article effective-view owner.

      Article Query -> ViewTracker transaction -> ArticleStats
      Article response -> ViewTracker.viewer_states/2
  """

  alias __MODULE__.{Query, Record, ViewDedupeCleanup}
  alias GroupherServer.{Accounts, RequestActor}
  alias Accounts.Model.User
  alias RequestActor.Classification

  @doc "Commits one Article view and its public/private projections."
  @spec track(struct(), User.t() | nil, Classification.t(), keyword()) ::
          {:ok, map()} | {:error, term()}
  defdelegate track(article, viewer, classification, opts \\ []), to: Record

  @doc "Returns viewer state for one Article. Anonymous viewers always receive false in V1."
  @spec viewer_state(struct(), User.t() | nil, keyword()) :: map() | {:error, term()}
  defdelegate viewer_state(article, viewer, opts \\ []), to: Query

  @doc "Returns batched viewer state keyed by `{thread, article_id}`."
  @spec viewer_states([struct()], User.t() | nil, keyword()) :: map() | {:error, term()}
  defdelegate viewer_states(articles, viewer, opts \\ []), to: Query

  @doc "Resolves public Article paths and returns ordered private viewer state."
  @spec viewer_states_for_paths([map()], User.t(), keyword()) ::
          {:ok, [map()]} | {:error, term()}
  defdelegate viewer_states_for_paths(paths, viewer, opts \\ []), to: Query

  @doc "Deletes all ViewTracker state during permanent Article deletion."
  @spec delete_article_state(atom(), pos_integer()) :: :ok
  defdelegate delete_article_state(thread, article_id), to: Record

  @doc "Drains expired dedupe state within the configured row and time budgets."
  defdelegate cleanup_expired(), to: ViewDedupeCleanup
end
