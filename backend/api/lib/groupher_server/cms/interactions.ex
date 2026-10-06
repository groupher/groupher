defmodule GroupherServer.CMS.Interactions do
  @moduledoc """
  Public product boundary for Artiment interactions.

      GraphQL / service Query
        -> CMS.Interactions
        -> Reaction / ReadState / Scope
        -> authoritative facts and derived read state

  The facade owns the stable Interaction reaction and read contracts. SQL,
  fact writers, derived ReadState, worker maintenance, and response assembly stay
  behind their respective domain owners.
  """

  alias GroupherServer.{Accounts, CMS}

  alias Accounts.Model.User
  alias CMS.Interactions.{ErrorCat, Reactions, ReadState, Scope}

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

  @doc "Returns public presentation state without current-viewer fields."
  defdelegate public_state(artiment, opts \\ []), to: ReadState

  @doc "Returns batched public presentation state without current-viewer fields."
  defdelegate public_states(artiments, opts \\ []), to: ReadState

  @doc """
  Returns lightweight fixed counts keyed by Artiment type and physical id.

  ## Examples

      CMS.Interactions.counts([article, comment])

  """
  @spec counts([struct()]) :: map() | {:error, ErrorCat.error()}
  defdelegate counts(artiments), to: ReadState

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
  @spec emotion(struct(), atom(), User.t(), String.t() | nil) ::
          {:ok, struct()} | {:error, term()}
  defdelegate emotion(artiment, emotion, actor, command_id \\ nil), to: Reactions

  @doc """
  Removes an Artiment emotion idempotently and returns the canonical Artiment.

  ## Examples

      CMS.Interactions.undo_emotion(comment, :heart, actor)

  """
  @spec undo_emotion(struct(), atom(), User.t(), String.t() | nil) ::
          {:ok, struct()} | {:error, term()}
  defdelegate undo_emotion(artiment, emotion, actor, command_id \\ nil), to: Reactions

  @doc """
  Adds an Artiment upvote idempotently and returns the canonical Artiment.

  ## Examples

      CMS.Interactions.upvote(article, actor)

  """
  @spec upvote(struct(), User.t(), String.t() | nil) :: {:ok, struct()} | {:error, term()}
  defdelegate upvote(artiment, actor, command_id \\ nil), to: Reactions

  @doc """
  Removes an Artiment upvote idempotently and returns the canonical Artiment.

  ## Examples

      CMS.Interactions.undo_upvote(article, actor)

  """
  @spec undo_upvote(struct(), User.t(), String.t() | nil) :: {:ok, struct()} | {:error, term()}
  defdelegate undo_upvote(artiment, actor, command_id \\ nil), to: Reactions

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

      CMS.Interactions.scope(CMS.Model.Article, thread: :post, order: :upvotes)

  """
  @spec scope(Ecto.Queryable.t(), keyword()) ::
          {:ok, Ecto.Query.t()} | {:error, ErrorCat.error()}
  defdelegate scope(queryable, opts), to: Scope
end
