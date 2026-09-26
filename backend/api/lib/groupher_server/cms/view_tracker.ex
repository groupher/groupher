defmodule GroupherServer.CMS.ViewTracker do
  @moduledoc """
  Synchronous Article effective-view owner.

      Article Reader -> ViewTracker transaction -> ArticleStats
      Article response -> ViewTracker.viewer_states/2
  """

  alias __MODULE__.{Query, Record, Retention}
  alias GroupherServer.Accounts.Model.User

  @doc "Commits one Article view decision and its public/private projections."
  @spec track(struct(), User.t() | nil, Ecto.UUID.t() | nil, keyword()) ::
          {:ok, map()} | {:error, term()}
  defdelegate track(article, viewer, event_id, opts \\ []), to: Record

  @doc "Returns viewer state for one Article. Anonymous viewers always receive false in V1."
  @spec viewer_state(struct(), User.t() | nil, keyword()) :: map() | {:error, term()}
  defdelegate viewer_state(article, viewer, opts \\ []), to: Query

  @doc "Returns batched viewer state keyed by `{thread, article_id}`."
  @spec viewer_states([struct()], User.t() | nil, keyword()) :: map() | {:error, term()}
  defdelegate viewer_states(articles, viewer, opts \\ []), to: Query

  @doc "Deletes all ViewTracker state during permanent Article deletion."
  @spec delete_article_state(atom(), pos_integer()) :: :ok
  defdelegate delete_article_state(thread, article_id), to: Record

  @doc "Deletes one bounded batch of expired transport and dedupe state."
  @spec delete_expired() :: %{receipts: non_neg_integer(), watermarks: non_neg_integer()}
  defdelegate delete_expired(), to: Retention
end
