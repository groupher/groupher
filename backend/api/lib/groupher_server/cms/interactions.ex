defmodule GroupherServer.CMS.Interactions do
  @moduledoc """
  Public product boundary for Artiment interactions.

      GraphQL / service Query
        -> CMS.Interactions
        -> Reaction / Projection / Scope
        -> authoritative facts and derived read state

  The facade owns the stable Interaction reaction and read contracts. SQL,
  fact persistence, derived Projection, worker maintenance, and response assembly stay
  behind their respective domain owners.
  """

  alias GroupherServer.{Accounts, CMS}

  alias Accounts.Model.User
  alias CMS.Interactions.{CommandResult, ErrorCat, Reactions, Projection, Scope}

  @doc """
  Returns typed Interaction state for one Artiment and optional viewer.

  ## Examples

      CMS.Interactions.viewer_state(article, viewer)

  """
  @spec viewer_state(struct(), User.t() | nil, keyword()) :: map() | {:error, term()}
  defdelegate viewer_state(artiment, viewer, opts \\ []), to: Projection

  @doc """
  Returns typed Interaction states keyed by Artiment type and physical id.

  ## Examples

      CMS.Interactions.viewer_states([article, comment], viewer)

  """
  @spec viewer_states([struct()], User.t() | nil, keyword()) :: map()
  defdelegate viewer_states(artiments, viewer, opts \\ []), to: Projection

  @doc "Resolves public Article paths and returns ordered private Interaction state."
  @spec article_states_for_paths([map()], User.t(), keyword()) ::
          {:ok, [map()]} | {:error, term()}
  defdelegate article_states_for_paths(paths, viewer, opts \\ []), to: Projection

  @doc """
  Maps an already-read Article locator and private Interaction state without IO.

  ## Examples

      CMS.Interactions.article_state(article_locator, viewer_state)
  """
  @spec article_state(map(), map()) :: map()
  defdelegate article_state(article, interaction), to: Projection

  @doc """
  Returns public presentation state without current-viewer fields.

  ## Examples

      CMS.Interactions.public_state(article)
  """
  @spec public_state(struct(), keyword()) :: map()
  defdelegate public_state(artiment, opts \\ []), to: Projection

  @doc """
  Returns batched public presentation state without current-viewer fields.

  ## Examples

      CMS.Interactions.public_states([article, comment])
  """
  @spec public_states([struct()], keyword()) :: map()
  defdelegate public_states(artiments, opts \\ []), to: Projection

  @doc """
  Returns lightweight fixed counts keyed by Artiment type and physical id.

  ## Examples

      CMS.Interactions.counts([article, comment])

  """
  @spec counts([struct()]) :: map() | {:error, ErrorCat.error()}
  defdelegate counts(artiments), to: Projection

  @doc """
  Collects an Article idempotently and returns the canonical Article.

  ## Examples

      CMS.Interactions.collect(article, actor, command_id)

  """
  @spec collect(struct(), User.t(), Ecto.UUID.t()) :: {:ok, struct()} | {:error, term()}
  defdelegate collect(article, actor, command_id), to: Reactions

  @doc """
  Removes an Article collect idempotently and returns the canonical Article.

  ## Examples

      CMS.Interactions.undo_collect(article, actor, command_id)

  """
  @spec undo_collect(struct(), User.t(), Ecto.UUID.t()) :: {:ok, struct()} | {:error, term()}
  defdelegate undo_collect(article, actor, command_id), to: Reactions

  @doc """
  Returns public paged users who collected an already-scoped Article.

  ## Examples

      CMS.Interactions.collected_users(article, %{page: 1, size: 20})

  """
  @spec collected_users(struct(), map()) :: {:ok, term()} | {:error, term()}
  defdelegate collected_users(article, pagi), to: Reactions

  @doc """
  Applies an Artiment emotion idempotently and returns the canonical Artiment.

  ## Examples

      CMS.Interactions.emotion(comment, :heart, actor, command_id)

  """
  @spec emotion(struct(), atom(), User.t(), Ecto.UUID.t()) ::
          {:ok, struct()} | {:error, term()}
  defdelegate emotion(artiment, emotion, actor, command_id), to: Reactions

  @doc """
  Applies an emotion and returns the stable command result.

  ## Examples

      CMS.Interactions.emotion_result(comment, :heart, actor, command_id)
  """
  @spec emotion_result(struct(), atom(), User.t(), Ecto.UUID.t()) ::
          {:ok, map() | struct()} | {:error, term()}
  def emotion_result(artiment, emotion, %User{} = actor, command_id) do
    artiment
    |> Reactions.emotion(emotion, actor, command_id)
    |> CommandResult.build(actor)
  end

  @doc """
  Removes an Artiment emotion idempotently and returns the canonical Artiment.

  ## Examples

      CMS.Interactions.undo_emotion(comment, :heart, actor, command_id)

  """
  @spec undo_emotion(struct(), atom(), User.t(), Ecto.UUID.t()) ::
          {:ok, struct()} | {:error, term()}
  defdelegate undo_emotion(artiment, emotion, actor, command_id), to: Reactions

  @doc """
  Removes an emotion and returns the stable command result.

  ## Examples

      CMS.Interactions.undo_emotion_result(comment, :heart, actor, command_id)
  """
  @spec undo_emotion_result(struct(), atom(), User.t(), Ecto.UUID.t()) ::
          {:ok, map() | struct()} | {:error, term()}
  def undo_emotion_result(artiment, emotion, %User{} = actor, command_id) do
    artiment
    |> Reactions.undo_emotion(emotion, actor, command_id)
    |> CommandResult.build(actor)
  end

  @doc """
  Adds an Artiment upvote idempotently and returns the canonical Artiment.

  ## Examples

      CMS.Interactions.upvote(article, actor, command_id)

  """
  @spec upvote(struct(), User.t(), Ecto.UUID.t()) :: {:ok, struct()} | {:error, term()}
  defdelegate upvote(artiment, actor, command_id), to: Reactions

  @doc """
  Applies an upvote and returns the stable command result.

  ## Examples

      CMS.Interactions.upvote_result(article, actor, command_id)
  """
  @spec upvote_result(struct(), User.t(), Ecto.UUID.t()) ::
          {:ok, map() | struct()} | {:error, term()}
  def upvote_result(artiment, %User{} = actor, command_id) do
    artiment
    |> Reactions.upvote(actor, command_id)
    |> CommandResult.build(actor)
  end

  @doc """
  Removes an Artiment upvote idempotently and returns the canonical Artiment.

  ## Examples

      CMS.Interactions.undo_upvote(article, actor, command_id)

  """
  @spec undo_upvote(struct(), User.t(), Ecto.UUID.t()) :: {:ok, struct()} | {:error, term()}
  defdelegate undo_upvote(artiment, actor, command_id), to: Reactions

  @doc """
  Removes an upvote and returns the stable command result.

  ## Examples

      CMS.Interactions.undo_upvote_result(article, actor, command_id)
  """
  @spec undo_upvote_result(struct(), User.t(), Ecto.UUID.t()) ::
          {:ok, map() | struct()} | {:error, term()}
  def undo_upvote_result(artiment, %User{} = actor, command_id) do
    artiment
    |> Reactions.undo_upvote(actor, command_id)
    |> CommandResult.build(actor)
  end

  @doc """
  Returns public paged users who upvoted an already-scoped Article.

  ## Examples

      CMS.Interactions.upvoted_users(article, %{page: 1, size: 20})

  """
  @spec upvoted_users(struct(), map()) :: {:ok, term()} | {:error, term()}
  defdelegate upvoted_users(article, pagi), to: Reactions

  @doc """
  Compiles Interaction-owned ordering into an Article queryable.

  ## Examples

      CMS.Interactions.scope(CMS.Model.Article, thread: :post, order: :upvotes)

  """
  @spec scope(Ecto.Queryable.t(), keyword()) ::
          {:ok, Ecto.Query.t()} | {:error, ErrorCat.error()}
  defdelegate scope(queryable, opts), to: Scope
end
