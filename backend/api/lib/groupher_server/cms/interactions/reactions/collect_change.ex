defmodule GroupherServer.CMS.Interactions.Reactions.CollectChange do
  @moduledoc """
  Applies the collect fact and its synchronous projections inside a caller-owned transaction.

  The top-level Collect Command and the Accounts collect-folder Command both call this step
  only after their pipeline gate has returned the canonical Article.

      Collect pipeline change stage
        -> CollectChange
        -> collect fact / projection / metric / achievement / effect
  """

  import Ecto.Query

  alias GroupherServer.{Accounts, CMS, Repo}
  alias Accounts.Model.User
  alias CMS.Artiment.Matcher
  alias CMS.Interactions.{Effects, ErrorCat, Persist, Projection}
  alias CMS.Model.{ArticleCollect, Author}

  @doc "Applies one idempotent collect set-state change in the existing transaction."
  @spec apply(struct(), User.t(), :add | :remove, Ecto.UUID.t()) ::
          {:ok, {struct(), :changed | :unchanged}} | {:error, term()}
  def apply(canonical, %User{} = actor, operation, operation_ref)
      when operation in [:add, :remove] do
    with true <- Repo.in_transaction?(),
         {:ok, %{collection?: true} = info} <- Matcher.match_interaction(canonical),
         {:ok, change} <- change_fact(canonical, info, actor, operation),
         {:ok, _} <- sync_state(canonical, actor, operation, change),
         {:ok, _} <- record_metric(canonical, operation, operation_ref, change),
         {:ok, _} <- sync_achievement(canonical, operation, change),
         {:ok, _} <- enqueue_effect(canonical, actor, operation, operation_ref, change) do
      {:ok, {canonical, change}}
    else
      false -> {:error, :pipeline_transaction_required}
      {:ok, %{collection?: false}} -> {:error, ErrorCat.unsupported_artiment("Comment")}
      {:error, _reason} = error -> error
    end
  end

  defp sync_state(_canonical, _actor, _operation, :unchanged), do: {:ok, :pass}

  defp sync_state(canonical, actor, operation, :changed) do
    result =
      if operation == :add,
        do: Projection.add_collect(canonical, actor),
        else: Projection.remove_collect(canonical, actor)

    case result do
      {:ok, _projection} -> {:ok, :pass}
      {:error, _reason} = error -> error
    end
  end

  defp record_metric(_article, _operation, _command_id, :unchanged), do: {:ok, :pass}

  defp record_metric(article, operation, command_id, :changed) do
    metric = if operation == :add, do: :collect_added, else: :collect_removed

    case GroupherServer.Analysis.metric_event_append_article_action(article, command_id, metric) do
      {:ok, _} -> {:ok, :pass}
      {:error, _reason} = error -> error
    end
  end

  defp sync_achievement(_article, _operation, :unchanged), do: {:ok, :pass}

  defp sync_achievement(article, operation, :changed) do
    achievement_operation = if operation == :add, do: :inc, else: :dec

    case Accounts.achievements_achieve(author_user(article), achievement_operation, :collect) do
      {:ok, _achievement} -> {:ok, :pass}
      {:error, _reason} = error -> error
    end
  end

  defp author_user(%{author: %{user_id: user_id}}), do: %User{id: user_id}
  defp author_user(%{author_id: author_id}), do: %User{id: Repo.get!(Author, author_id).user_id}

  defp enqueue_effect(_article, _actor, _operation, _operation_ref, :unchanged), do: {:ok, :pass}

  defp enqueue_effect(article, actor, operation, operation_ref, :changed) do
    Effects.enqueue_reaction_changed(
      "interaction.collect_changed",
      "article",
      article.id,
      operation_ref,
      %{actor_id: actor.id, operation: operation}
    )
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

    Persist.insert_fact(
      ArticleCollect,
      attrs,
      collect_conflict_target(info.foreign_key),
      "collect"
    )
  end

  defp change_fact(article, info, actor, :remove) do
    foreign_key = info.foreign_key

    query =
      from(collect in ArticleCollect,
        where: field(collect, ^foreign_key) == ^article.id and collect.user_id == ^actor.id
      )

    Persist.delete_fact(query, "collect")
  end

  defp collect_conflict_target(:article_id) do
    {:unsafe_fragment, "(user_id, article_id) WHERE article_id IS NOT NULL"}
  end

  defp collect_conflict_target(foreign_key), do: [:user_id, foreign_key]
end
