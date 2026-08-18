defmodule GroupherServer.CMS.Interactions.Upvote do
  @moduledoc """
  Executes idempotent Article and Comment upvote commands.

      CMS.Interactions
        -> Gate canonical Artiment
        -> upvote fact changed/unchanged
        -> Interaction State in the same transaction
        -> post-commit events and search metrics
  """

  import Ecto.Query

  alias GroupherServer.{Accounts, CMS, Repo}
  alias GroupherServer.Accounts.Model.User
  alias CMS.Artiment.Matcher
  alias CMS.Interactions.{ErrorCat, State}
  alias CMS.Model.{ArticleUpvote, Author, Comment, CommentUpvote}
  alias CMS.SearchArtiments.Indexer
  alias CMS.{Events, FrontDesk, Gate}
  alias Helper.{Later, T}

  @type change :: :changed | :unchanged

  @doc "Adds an upvote as an idempotent set-state command."
  @spec add(struct(), User.t()) :: T.domain_res(struct())
  def add(artiment, %User{} = actor), do: mutate(artiment, actor, :add)

  @doc "Removes an upvote as an idempotent set-state command."
  @spec remove(struct(), User.t()) :: T.domain_res(struct())
  def remove(artiment, %User{} = actor), do: mutate(artiment, actor, :remove)

  @doc "Returns the public paged users for an already-scoped Article."
  @spec users(struct(), map()) :: T.domain_res(term())
  def users(article, filter) when is_map(filter) do
    case Matcher.match_interaction(article) do
      {:ok, %{artiment: artiment}} when artiment in [:post, :blog, :changelog, :doc] ->
        FrontDesk.load_reaction_users(ArticleUpvote, article, filter)

      _ ->
        {:error, ErrorCat.unsupported_artiment("upvoted_users only supports Article")}
    end
  end

  defp mutate(input, actor, operation) do
    Repo.transaction(fn ->
      with {:ok, canonical} <- Gate.access_check(actor, :upvote, input),
           {:ok, info} <- Matcher.match_interaction(canonical),
           {:ok, change} <- change_fact(canonical, info, actor, operation),
           :ok <- sync_state(canonical, actor, operation, change),
           :ok <- maybe_achieve(canonical, actor, operation, change) do
        {canonical, change}
      else
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
    |> after_commit(operation, actor)
  end

  defp change_fact(%Comment{} = comment, _info, actor, :add) do
    insert_fact(
      CommentUpvote,
      %{comment_id: comment.id, user_id: actor.id},
      [:user_id, :comment_id]
    )
  end

  defp change_fact(%Comment{} = comment, _info, actor, :remove) do
    delete_fact(
      from(upvote in CommentUpvote,
        where: upvote.comment_id == ^comment.id and upvote.user_id == ^actor.id
      )
    )
  end

  defp change_fact(article, info, actor, :add) do
    attrs =
      %{user_id: actor.id, thread: info.artiment}
      |> Map.put(info.foreign_key, article.id)

    insert_fact(ArticleUpvote, attrs, [:user_id, info.foreign_key])
  end

  defp change_fact(article, info, actor, :remove) do
    foreign_key = info.foreign_key

    delete_fact(
      from(upvote in ArticleUpvote,
        where: field(upvote, ^foreign_key) == ^article.id and upvote.user_id == ^actor.id
      )
    )
  end

  defp insert_fact(schema, attrs, conflict_target) do
    now = DateTime.utc_now(:second)
    attrs = Map.merge(attrs, %{inserted_at: now, updated_at: now})

    case Repo.insert_all(schema, [attrs],
           on_conflict: :nothing,
           conflict_target: conflict_target
         ) do
      {1, _rows} -> {:ok, :changed}
      {0, _rows} -> {:ok, :unchanged}
      _ -> {:error, ErrorCat.interaction_state_conflict("unexpected upvote insert result")}
    end
  end

  defp delete_fact(query) do
    case Repo.delete_all(query) do
      {1, _rows} -> {:ok, :changed}
      {0, _rows} -> {:ok, :unchanged}
      _ -> {:error, ErrorCat.interaction_state_conflict("multiple upvote facts deleted")}
    end
  end

  defp sync_state(_canonical, _actor, _operation, :unchanged), do: :ok

  defp sync_state(canonical, actor, operation, :changed) do
    result =
      if operation == :add,
        do: State.add_upvote(canonical, actor),
        else: State.remove_upvote(canonical, actor)

    case result do
      {:ok, _projection} -> :ok
      {:error, _reason} = error -> error
    end
  end

  defp maybe_achieve(%Comment{}, _actor, _operation, _change), do: :ok
  defp maybe_achieve(_article, _actor, _operation, :unchanged), do: :ok
  defp maybe_achieve(_article, _actor, :remove, :changed), do: :ok

  defp maybe_achieve(article, _actor, :add, :changed) do
    case Accounts.Achievements.achieve(author_user(article), :inc, :upvote) do
      {:ok, _achievement} -> :ok
      {:error, _reason} = error -> error
    end
  end

  defp author_user(%{author: %{user_id: user_id}}), do: %User{id: user_id}
  defp author_user(%{author_id: author_id}), do: %User{id: Repo.get!(Author, author_id).user_id}

  defp after_commit({:ok, {canonical, :unchanged}}, _operation, _actor),
    do: {:ok, canonical}

  defp after_commit({:ok, {canonical, :changed}}, operation, actor) do
    emit(canonical, operation, actor)
    maybe_sync_search(canonical)
    {:ok, canonical}
  end

  defp after_commit({:error, reason}, _operation, _actor), do: {:error, reason}

  defp emit(canonical, :add, actor) do
    Later.run({Events, :emit, [:notify_upvote, %{target: canonical, from_user: actor}]})

    target = if match?(%Comment{}, canonical), do: canonical, else: canonical.community
    Later.run({Events, :emit, [:subscribe_community, %{target: target, user: actor}]})
  end

  defp emit(canonical, :remove, actor) do
    Later.run({Events, :emit, [:notify_undo_upvote, %{target: canonical, from_user: actor}]})
  end

  defp maybe_sync_search(%Comment{}), do: :ok
  defp maybe_sync_search(article), do: Indexer.enqueue_metrics(article)
end
