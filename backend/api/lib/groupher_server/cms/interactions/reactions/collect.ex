defmodule GroupherServer.CMS.Interactions.Reactions.Collect do
  @moduledoc """
  Owns the complete idempotent Article collect flow.

      CMS.Interactions
        -> Gate canonical Article
        -> collect fact changed/unchanged
        -> Interaction State and author achievement in one transaction
        -> post-commit notification
  """

  import Ecto.Query

  alias GroupherServer.{Accounts, Analysis, CMS, Repo}

  alias Accounts.Model.User
  alias CMS.Articles.MutationLock
  alias CMS.Artiment.Matcher
  alias CMS.{FrontDesk, Gate}
  alias CMS.Interactions.{ErrorCat, ReadState}
  alias CMS.Model.{ArticleCollect, Author}
  alias Analysis.MetricEvent
  alias Helper.T

  @doc """
  Collects an Article as an idempotent set-state command.

  ## Examples

      Reactions.Collect.add(article, actor)

  """
  @spec add(struct(), User.t()) :: T.domain_res(struct())
  def add(article, %User{} = actor), do: mutate(article, actor, :add)

  @doc """
  Removes an Article collect as an idempotent set-state command.

  ## Examples

      Reactions.Collect.remove(article, actor)

  """
  @spec remove(struct(), User.t()) :: T.domain_res(struct())
  def remove(article, %User{} = actor), do: mutate(article, actor, :remove)

  defp mutate(input, actor, operation) do
    MutationLock.observe_transaction(fn ->
      Repo.transaction(fn ->
        with {:ok, canonical} <- Gate.access_check(actor, :collect, input),
             {:ok, %{collection?: true} = info} <- Matcher.match_interaction(canonical),
             {:ok, change} <- change_fact(canonical, info, actor, operation),
             :ok <- sync_state(canonical, actor, operation, change),
             :ok <- record_metric(canonical, operation, change),
             :ok <- sync_achievement(canonical, operation, change),
             :ok <- enqueue_effect(canonical, actor, operation, change) do
          {canonical, change}
        else
          {:ok, %{collection?: false}} ->
            Repo.rollback(ErrorCat.unsupported_artiment("Comment"))

          {:error, reason} ->
            Repo.rollback(reason)
        end
      end)
    end)
    |> normalize_result()
  end

  defp sync_state(_canonical, _actor, _operation, :unchanged), do: :ok

  defp sync_state(canonical, actor, operation, :changed) do
    result =
      if operation == :add,
        do: ReadState.add_collect(canonical, actor),
        else: ReadState.remove_collect(canonical, actor)

    case result do
      {:ok, _projection} -> :ok
      {:error, _reason} = error -> error
    end
  end

  defp record_metric(_article, _operation, :unchanged), do: :ok

  defp record_metric(article, operation, :changed) do
    metric = if operation == :add, do: :collect_added, else: :collect_removed

    case MetricEvent.append_article_action(article, Ecto.UUID.generate(), metric) do
      :ok -> :ok
      {:error, _reason} = error -> error
    end
  end

  defp sync_achievement(_article, _operation, :unchanged), do: :ok

  defp sync_achievement(article, operation, :changed) do
    achievement_operation = if operation == :add, do: :inc, else: :dec

    case Accounts.Achievements.achieve(
           author_user(article),
           achievement_operation,
           :collect
         ) do
      {:ok, _achievement} -> :ok
      {:error, _reason} = error -> error
    end
  end

  defp author_user(%{author: %{user_id: user_id}}), do: %User{id: user_id}
  defp author_user(%{author_id: author_id}), do: %User{id: Repo.get!(Author, author_id).user_id}

  defp enqueue_effect(_article, _actor, _operation, :unchanged), do: :ok

  defp enqueue_effect(article, actor, operation, :changed) do
    case CMS.Outbox.send(%{
           event: "interaction.collect_changed",
           worker: CMS.Outbox.Workers.Interaction.Cleanup,
           resource_type: "article",
           resource_id: article.id,
           command_id: Ecto.UUID.generate(),
           data: %{actor_id: actor.id, operation: operation}
         }) do
      {:ok, _event} -> :ok
      {:error, reason} -> {:error, reason}
    end
  end

  defp normalize_result({:ok, {canonical, _change}}), do: {:ok, canonical}
  defp normalize_result({:error, reason}), do: {:error, reason}

  @doc """
  Returns paged users for an already-scoped Article collect set.

  ## Examples

      Reactions.Collect.users(article, %{page: 1, size: 20})

  """
  @spec users(struct(), map()) :: {:ok, term()} | {:error, term()}
  def users(article, filter) when is_map(filter) do
    case Matcher.match_interaction(article) do
      {:ok, %{collection?: true}} ->
        FrontDesk.load_reaction_users(ArticleCollect, article, filter)

      _ ->
        {:error, ErrorCat.unsupported_artiment("collected_users only supports Article")}
    end
  end

  defp change_fact(article, info, actor, :add) do
    now = DateTime.utc_now(:second)

    attrs =
      %{
        user_id: actor.id,
        thread: info.artiment,
        collect_folders: [],
        inserted_at: now,
        updated_at: now
      }
      |> Map.put(info.foreign_key, article.id)

    case Repo.insert_all(ArticleCollect, [attrs],
           on_conflict: :nothing,
           conflict_target: collect_conflict_target(info.foreign_key)
         ) do
      {1, _rows} -> {:ok, :changed}
      {0, _rows} -> {:ok, :unchanged}
      _ -> {:error, ErrorCat.interaction_state_conflict("unexpected collect insert result")}
    end
  end

  defp change_fact(article, info, actor, :remove) do
    foreign_key = info.foreign_key

    query =
      from(collect in ArticleCollect,
        where: field(collect, ^foreign_key) == ^article.id and collect.user_id == ^actor.id
      )

    case Repo.delete_all(query) do
      {1, _rows} -> {:ok, :changed}
      {0, _rows} -> {:ok, :unchanged}
      _ -> {:error, ErrorCat.interaction_state_conflict("multiple collect facts deleted")}
    end
  end

  defp collect_conflict_target(:article_id),
    do:
      {:unsafe_fragment,
       "(user_id, article_id) WHERE article_id IS NOT NULL AND branch_id IS NULL"}

  defp collect_conflict_target(foreign_key), do: [:user_id, foreign_key]
end
