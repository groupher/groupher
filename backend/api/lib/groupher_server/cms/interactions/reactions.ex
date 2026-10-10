defmodule GroupherServer.CMS.Interactions.Reactions do
  @moduledoc """
  Routes user-driven Artiment reactions to their concrete implementation.

  This facade contains no persistence or transaction logic. Each concrete
  reaction owns its complete business flow.

      CMS.Interactions -> Reactions -> Upvote / Emotion / Collect / Report
  """

  alias __MODULE__.{Collect, Emotion, Report, Upvote}
  alias GroupherServer.Accounts
  alias Accounts.Model.User

  @doc """
  Adds an Artiment upvote idempotently.

  ## Examples

      Reactions.upvote(article, actor, command_id)

  """
  @spec upvote(struct(), User.t(), Ecto.UUID.t()) :: {:ok, struct()} | {:error, term()}
  defdelegate upvote(artiment, actor, command_id), to: Upvote, as: :add

  @doc """
  Removes an Artiment upvote idempotently.

  ## Examples

      Reactions.undo_upvote(article, actor, command_id)

  """
  @spec undo_upvote(struct(), User.t(), Ecto.UUID.t()) :: {:ok, struct()} | {:error, term()}
  defdelegate undo_upvote(artiment, actor, command_id), to: Upvote, as: :remove

  @doc """
  Applies an emotion idempotently.

  ## Examples

      Reactions.emotion(comment, :heart, actor, command_id)

  """
  @spec emotion(struct(), atom(), User.t(), Ecto.UUID.t()) ::
          {:ok, struct()} | {:error, term()}
  defdelegate emotion(artiment, emotion, actor, command_id), to: Emotion, as: :add

  @doc """
  Removes an emotion idempotently.

  ## Examples

      Reactions.undo_emotion(comment, :heart, actor, command_id)

  """
  @spec undo_emotion(struct(), atom(), User.t(), Ecto.UUID.t()) ::
          {:ok, struct()} | {:error, term()}
  defdelegate undo_emotion(artiment, emotion, actor, command_id),
    to: Emotion,
    as: :remove

  @doc """
  Collects an Article idempotently.

  ## Examples

      Reactions.collect(article, actor, command_id)

  """
  @spec collect(struct(), User.t(), Ecto.UUID.t()) :: {:ok, struct()} | {:error, term()}
  defdelegate collect(article, actor, command_id), to: Collect, as: :add

  @doc """
  Removes an Article collect idempotently.

  ## Examples

      Reactions.undo_collect(article, actor, command_id)

  """
  @spec undo_collect(struct(), User.t(), Ecto.UUID.t()) :: {:ok, struct()} | {:error, term()}
  defdelegate undo_collect(article, actor, command_id), to: Collect, as: :remove

  @doc """
  Adds one immutable-reporter report fact.

  ## Examples

      Reactions.report(comment, "spam", %{}, actor, command_id)

  """
  @spec report(struct(), String.t(), term(), User.t(), Ecto.UUID.t()) ::
          {:ok, struct()} | {:error, term()}
  defdelegate report(artiment, reason, attrs, actor, command_id), to: Report, as: :add

  @doc """
  Removes the actor's report fact idempotently.

  ## Examples

      Reactions.undo_report(comment, actor, command_id)

  """
  @spec undo_report(struct(), User.t(), Ecto.UUID.t()) :: {:ok, struct()} | {:error, term()}
  defdelegate undo_report(artiment, actor, command_id), to: Report, as: :remove

  @doc """
  Returns public paged users who upvoted an already-scoped Article.

  ## Examples

      Reactions.upvoted_users(article, %{page: 1, size: 20})

  """
  @spec upvoted_users(struct(), map()) :: {:ok, term()} | {:error, term()}
  defdelegate upvoted_users(article, filter), to: Upvote, as: :users

  @doc """
  Returns public paged users who collected an already-scoped Article.

  ## Examples

      Reactions.collected_users(article, %{page: 1, size: 20})

  """
  @spec collected_users(struct(), map()) :: {:ok, term()} | {:error, term()}
  defdelegate collected_users(article, filter), to: Collect, as: :users
end
