defmodule GroupherServer.CMS.Interactions do
  @moduledoc """
  Public product boundary for Artiment interactions.

      GraphQL / service Reader
        -> CMS.Interactions
        -> Reaction / ReadState / Scope / ViewEvents
        -> authoritative facts and derived read state

  The facade owns the stable Interaction reaction and read contracts. SQL,
  fact writers, derived ReadState, worker maintenance, and response assembly stay
  behind their respective domain owners.
  """

  alias GroupherServer.Accounts.Model.User

  alias GroupherServer.CMS.Interactions.{Reactions, ReadState, Scope, ViewEvents}

  @doc """
  Reports an Artiment using the immutable reporter identity.

  ## Examples

      CMS.Interactions.report(comment, "spam", %{}, actor)

  """
  @spec report(struct(), String.t(), term(), User.t()) :: {:ok, struct()} | {:error, term()}
  defdelegate report(artiment, reason, attrs, actor), to: Reactions

  @doc """
  Removes the current actor's Artiment report idempotently.

  ## Examples

      CMS.Interactions.undo_report(comment, actor)

  """
  @spec undo_report(struct(), User.t()) :: {:ok, struct()} | {:error, term()}
  defdelegate undo_report(artiment, actor), to: Reactions

  @doc """
  Returns typed Interaction state for one Artiment and optional viewer.

  ## Examples

      CMS.Interactions.viewer_state(article, viewer)

  """
  @spec viewer_state(struct(), User.t() | nil, keyword()) :: map() | {:error, term()}
  defdelegate viewer_state(artiment, viewer, opts \\ []), to: ReadState

  @doc """
  Returns typed Interaction states keyed by Artiment type and physical id.

  ## Examples

      CMS.Interactions.viewer_states([article, comment], viewer)

  """
  @spec viewer_states([struct()], User.t() | nil, keyword()) :: map()
  defdelegate viewer_states(artiments, viewer, opts \\ []), to: ReadState

  @doc """
  Returns lightweight fixed counts keyed by Artiment type and physical id.

  ## Examples

      CMS.Interactions.counts([article, comment])

  """
  @spec counts([struct()]) :: map() | {:error, GroupherServer.ErrorCat.Error.t()}
  defdelegate counts(artiments), to: ReadState

  @doc """
  Records a durable Article view without taking the aggregate mutation lock.

  ## Examples

      CMS.Interactions.record_view(article, viewer, event_id)

  """
  @spec record_view(struct(), User.t() | nil, Ecto.UUID.t() | nil) ::
          {:ok, Ecto.UUID.t()} | {:error, term()}
  defdelegate record_view(article, viewer, event_id), to: ViewEvents, as: :record

  @doc """
  Collects an Article idempotently and returns the canonical Article.

  ## Examples

      CMS.Interactions.collect(article, actor)

  """
  @spec collect(struct(), User.t()) :: {:ok, struct()} | {:error, term()}
  defdelegate collect(article, actor), to: Reactions

  @doc """
  Removes an Article collect idempotently and returns the canonical Article.

  ## Examples

      CMS.Interactions.undo_collect(article, actor)

  """
  @spec undo_collect(struct(), User.t()) :: {:ok, struct()} | {:error, term()}
  defdelegate undo_collect(article, actor), to: Reactions

  @doc """
  Returns public paged users who collected an already-scoped Article.

  ## Examples

      CMS.Interactions.collected_users(article, %{page: 1, size: 20})

  """
  @spec collected_users(struct(), map()) :: {:ok, term()} | {:error, term()}
  defdelegate collected_users(article, filter), to: Reactions

  @doc """
  Applies an Artiment emotion idempotently and returns the canonical Artiment.

  ## Examples

      CMS.Interactions.emotion(comment, :heart, actor)

  """
  @spec emotion(struct(), atom(), User.t()) :: {:ok, struct()} | {:error, term()}
  defdelegate emotion(artiment, emotion, actor), to: Reactions

  @doc """
  Removes an Artiment emotion idempotently and returns the canonical Artiment.

  ## Examples

      CMS.Interactions.undo_emotion(comment, :heart, actor)

  """
  @spec undo_emotion(struct(), atom(), User.t()) :: {:ok, struct()} | {:error, term()}
  defdelegate undo_emotion(artiment, emotion, actor), to: Reactions

  @doc """
  Adds an Artiment upvote idempotently and returns the canonical Artiment.

  ## Examples

      CMS.Interactions.upvote(article, actor)

  """
  @spec upvote(struct(), User.t()) :: {:ok, struct()} | {:error, term()}
  defdelegate upvote(artiment, actor), to: Reactions

  @doc """
  Removes an Artiment upvote idempotently and returns the canonical Artiment.

  ## Examples

      CMS.Interactions.undo_upvote(article, actor)

  """
  @spec undo_upvote(struct(), User.t()) :: {:ok, struct()} | {:error, term()}
  defdelegate undo_upvote(artiment, actor), to: Reactions

  @doc """
  Returns public paged users who upvoted an already-scoped Article.

  ## Examples

      CMS.Interactions.upvoted_users(article, %{page: 1, size: 20})

  """
  @spec upvoted_users(struct(), map()) :: {:ok, term()} | {:error, term()}
  defdelegate upvoted_users(article, filter), to: Reactions

  @doc """
  Compiles Interaction-owned ordering into an Article queryable.

  ## Examples

      CMS.Interactions.scope(Post, order: :upvotes)

  """
  @spec scope(Ecto.Queryable.t(), keyword()) ::
          {:ok, Ecto.Query.t()} | {:error, GroupherServer.ErrorCat.Error.t()}
  defdelegate scope(queryable, opts), to: Scope
end
