defmodule GroupherServer.CMS.Interactions do
  @moduledoc """
  Public product boundary for Artiment interactions.

      GraphQL / service Reader
        -> CMS.Interactions
        -> Interaction query or command
        -> fact and derived state

  V4 is introduced in phases. Query scope is the first public operation moved
  here; mutation commands are added as their transaction contracts migrate.
  """

  alias GroupherServer.Accounts.Model.User

  alias GroupherServer.CMS.Interactions.{
    Collect,
    Emotion,
    Report,
    Scope,
    Upvote,
    View,
    ViewerState
  }

  @doc "Reports an Artiment using the immutable reporter identity."
  @spec report(struct(), String.t(), term(), User.t()) :: {:ok, struct()} | {:error, term()}
  defdelegate report(artiment, reason, attrs, actor), to: Report, as: :add

  @doc "Removes the current actor's Artiment report idempotently."
  @spec undo_report(struct(), User.t()) :: {:ok, struct()} | {:error, term()}
  defdelegate undo_report(artiment, actor), to: Report, as: :remove

  @doc "Returns typed Interaction state for one Artiment and optional viewer."
  @spec viewer_state(struct(), User.t() | nil, keyword()) :: struct()
  defdelegate viewer_state(artiment, viewer, opts \\ []), to: ViewerState, as: :one

  @doc "Returns typed Interaction states keyed by Artiment type and physical id."
  @spec viewer_states([struct()], User.t() | nil, keyword()) :: map()
  defdelegate viewer_states(artiments, viewer, opts \\ []), to: ViewerState, as: :many

  @doc "Records a durable Article view without taking the aggregate mutation lock."
  @spec record_view(struct(), User.t() | nil, Ecto.UUID.t() | nil) ::
          {:ok, Ecto.UUID.t()} | {:error, term()}
  defdelegate record_view(article, viewer, event_id), to: View, as: :record

  @doc "Collects an Article idempotently and returns the canonical Article."
  @spec collect(struct(), User.t()) :: {:ok, struct()} | {:error, term()}
  defdelegate collect(article, actor), to: Collect, as: :add

  @doc "Removes an Article collect idempotently and returns the canonical Article."
  @spec undo_collect(struct(), User.t()) :: {:ok, struct()} | {:error, term()}
  defdelegate undo_collect(article, actor), to: Collect, as: :remove

  @doc "Returns public paged users who collected an already-scoped Article."
  @spec collected_users(struct(), map()) :: {:ok, term()} | {:error, term()}
  defdelegate collected_users(article, filter), to: Collect, as: :users

  @doc "Applies an Artiment emotion idempotently and returns the canonical Artiment."
  @spec emotion(struct(), atom(), User.t()) :: {:ok, struct()} | {:error, term()}
  defdelegate emotion(artiment, emotion, actor), to: Emotion, as: :add

  @doc "Removes an Artiment emotion idempotently and returns the canonical Artiment."
  @spec undo_emotion(struct(), atom(), User.t()) :: {:ok, struct()} | {:error, term()}
  defdelegate undo_emotion(artiment, emotion, actor), to: Emotion, as: :remove

  @doc "Adds an Artiment upvote idempotently and returns the canonical Artiment."
  @spec upvote(struct(), User.t()) :: {:ok, struct()} | {:error, term()}
  defdelegate upvote(artiment, actor), to: Upvote, as: :add

  @doc "Removes an Artiment upvote idempotently and returns the canonical Artiment."
  @spec undo_upvote(struct(), User.t()) :: {:ok, struct()} | {:error, term()}
  defdelegate undo_upvote(artiment, actor), to: Upvote, as: :remove

  @doc "Returns public paged users who upvoted an already-scoped Article."
  @spec upvoted_users(struct(), map()) :: {:ok, term()} | {:error, term()}
  defdelegate upvoted_users(article, filter), to: Upvote, as: :users

  @doc "Compiles Interaction-owned ordering into an Article queryable."
  @spec scope(Ecto.Queryable.t(), keyword()) ::
          {:ok, Ecto.Query.t()} | {:error, GroupherServer.ErrorCat.Error.t()}
  defdelegate scope(queryable, opts), to: Scope
end
