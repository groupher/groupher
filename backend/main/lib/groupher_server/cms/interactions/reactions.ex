defmodule GroupherServer.CMS.Interactions.Reactions do
  @moduledoc """
  Routes user-driven Artiment reactions to their concrete implementation.

  This facade contains no persistence or transaction logic. Each concrete
  reaction owns its complete business flow.

      CMS.Interactions -> Reactions -> Upvote / Emotion / Collect / Report
  """

  alias GroupherServer.Accounts.Model.User
  alias __MODULE__.{Collect, Emotion, Report, Upvote}

  @doc """
  Adds an Artiment upvote idempotently.

  ## Examples

      Reactions.upvote(article, actor)

  """
  @spec upvote(struct(), User.t()) :: {:ok, struct()} | {:error, term()}
  defdelegate upvote(artiment, actor), to: Upvote, as: :add

  @doc """
  Removes an Artiment upvote idempotently.

  ## Examples

      Reactions.undo_upvote(article, actor)

  """
  @spec undo_upvote(struct(), User.t()) :: {:ok, struct()} | {:error, term()}
  defdelegate undo_upvote(artiment, actor), to: Upvote, as: :remove

  @doc """
  Applies an emotion idempotently.

  ## Examples

      Reactions.emotion(comment, :heart, actor)

  """
  @spec emotion(struct(), atom(), User.t()) :: {:ok, struct()} | {:error, term()}
  defdelegate emotion(artiment, emotion, actor), to: Emotion, as: :add

  @doc """
  Removes an emotion idempotently.

  ## Examples

      Reactions.undo_emotion(comment, :heart, actor)

  """
  @spec undo_emotion(struct(), atom(), User.t()) :: {:ok, struct()} | {:error, term()}
  defdelegate undo_emotion(artiment, emotion, actor), to: Emotion, as: :remove

  @doc """
  Collects an Article idempotently.

  ## Examples

      Reactions.collect(article, actor)

  """
  @spec collect(struct(), User.t()) :: {:ok, struct()} | {:error, term()}
  defdelegate collect(article, actor), to: Collect, as: :add

  @doc """
  Removes an Article collect idempotently.

  ## Examples

      Reactions.undo_collect(article, actor)

  """
  @spec undo_collect(struct(), User.t()) :: {:ok, struct()} | {:error, term()}
  defdelegate undo_collect(article, actor), to: Collect, as: :remove

  @doc """
  Adds one immutable-reporter report fact.

  ## Examples

      Reactions.report(comment, "spam", %{}, actor)

  """
  @spec report(struct(), String.t(), term(), User.t()) :: {:ok, struct()} | {:error, term()}
  defdelegate report(artiment, reason, attrs, actor), to: Report, as: :add

  @doc """
  Removes the actor's report fact idempotently.

  ## Examples

      Reactions.undo_report(comment, actor)

  """
  @spec undo_report(struct(), User.t()) :: {:ok, struct()} | {:error, term()}
  defdelegate undo_report(artiment, actor), to: Report, as: :remove

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
