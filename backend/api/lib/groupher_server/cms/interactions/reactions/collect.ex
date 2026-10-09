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
  alias CMS.{Command, Gate, Interactions}
  alias CMS.Interactions.{ErrorCat, ReadState}
  alias CMS.Interactions.Reactions.CollectConfirmation, as: Confirmation
  alias CMS.Model.{ArticleCollect, Author}
  alias Analysis.MetricEvent
  alias Helper.T

  @doc """
  Collects an Article as an idempotent set-state command.

  ## Examples

      Reactions.Collect.add(article, actor)

  """
  @spec add(struct(), User.t(), Ecto.UUID.t()) :: T.domain_res(struct())
  def add(article, %User{} = actor, command_id),
    do: mutate(article, actor, :add, command_id)

  @doc """
  Removes an Article collect as an idempotent set-state command.

  ## Examples

      Reactions.Collect.remove(article, actor)

  """
  @spec remove(struct(), User.t(), Ecto.UUID.t()) :: T.domain_res(struct())
  def remove(article, %User{} = actor, command_id),
    do: mutate(article, actor, :remove, command_id)

  defp mutate(input, actor, operation, command_id) do
    with {:ok, command_id} <- require_command_id(command_id),
         {:ok, info} <- Matcher.match_interaction(input) do
      if Repo.in_transaction?() do
        MutationLock.observe_transaction(fn ->
          with {:ok, {canonical, change}} <-
                 collect_transaction(input, actor, operation, command_id, info) do
            {:ok, reaction_projection(canonical, command_id, change)}
          end
        end)
      else
        %Command{
          actor: actor,
          command_id: command_id,
          operation: collect_command(operation),
          target: input,
          params: %{operation: operation}
        }
        |> Command.execute(action: &collect_action(&1, info), confirmation: Confirmation)
        |> present_reaction(input, command_id)
      end
    end
  end

  defp collect_action(
         %{
           actor: actor,
           target: input,
           params: %{operation: operation},
           command_id: command_id
         },
         info
       ) do
    with {:ok, {canonical, change}} <-
           MutationLock.observe_transaction(fn ->
             collect_transaction(input, actor, operation, command_id, info)
           end) do
      {:ok,
       %Confirmation{
         data: %{
           "target_id" => to_string(canonical.id),
           "target_type" => "article",
           "operation" => Atom.to_string(operation),
           "outcome" => Atom.to_string(change)
         }
       }}
    end
  end

  defp collect_transaction(input, actor, operation, command_id, _info) do
    transaction = fn ->
      with {:ok, canonical} <- Gate.access_check(actor, :collect, input),
           {:ok, %{collection?: true} = canonical_info} <- Matcher.match_interaction(canonical),
           {:ok, change} <- change_fact(canonical, canonical_info, actor, operation),
           {:ok, _} <- sync_state(canonical, actor, operation, change),
           {:ok, _} <- record_metric(canonical, operation, command_id, change),
           {:ok, _} <- sync_achievement(canonical, operation, change),
           {:ok, _} <- enqueue_effect(canonical, actor, operation, command_id, change) do
        {canonical, change}
      else
        {:ok, %{collection?: false}} ->
          Repo.rollback(ErrorCat.unsupported_artiment("Comment"))

        {:error, reason} ->
          Repo.rollback(reason)
      end
    end

    if Repo.in_transaction?(), do: {:ok, transaction.()}, else: Repo.transaction(transaction)
  end

  defp sync_state(_canonical, _actor, _operation, :unchanged), do: {:ok, :pass}

  defp sync_state(canonical, actor, operation, :changed) do
    result =
      if operation == :add,
        do: ReadState.add_collect(canonical, actor),
        else: ReadState.remove_collect(canonical, actor)

    case result do
      {:ok, _projection} -> {:ok, :pass}
      {:error, _reason} = error -> error
    end
  end

  defp record_metric(_article, _operation, _command_id, :unchanged), do: {:ok, :pass}

  defp record_metric(article, operation, command_id, :changed) do
    metric = if operation == :add, do: :collect_added, else: :collect_removed

    case MetricEvent.append_article_action(article, command_id, metric) do
      {:ok, _} -> {:ok, :pass}
      {:error, _reason} = error -> error
    end
  end

  defp sync_achievement(_article, _operation, :unchanged), do: {:ok, :pass}

  defp sync_achievement(article, operation, :changed) do
    achievement_operation = if operation == :add, do: :inc, else: :dec

    case Accounts.Achievements.achieve(
           author_user(article),
           achievement_operation,
           :collect
         ) do
      {:ok, _achievement} -> {:ok, :pass}
      {:error, _reason} = error -> error
    end
  end

  defp author_user(%{author: %{user_id: user_id}}), do: %User{id: user_id}
  defp author_user(%{author_id: author_id}), do: %User{id: Repo.get!(Author, author_id).user_id}

  defp enqueue_effect(_article, _actor, _operation, _command_id, :unchanged), do: {:ok, :pass}

  defp enqueue_effect(article, actor, operation, command_id, :changed) do
    case CMS.Outbox.send(%{
           event: "interaction.collect_changed",
           worker: CMS.Outbox.Workers.Interaction.Cleanup,
           resource_type: "article",
           resource_id: article.id,
           command_id: command_id,
           effect_key: "article:#{article.id}:#{operation}",
           data: %{actor_id: actor.id, operation: operation}
         }) do
      {:ok, _event} -> {:ok, :pass}
      {:error, reason} -> {:error, reason}
    end
  end

  defp require_command_id(command_id) when is_binary(command_id), do: {:ok, command_id}
  defp require_command_id(_command_id), do: {:error, CMS.ErrorCat.command_id_required()}

  defp collect_command(:add), do: :reaction_collect_add
  defp collect_command(:remove), do: :reaction_collect_remove

  defp present_reaction({:ok, %Confirmation{data: data}}, input, command_id) do
    outcome = if data["outcome"] == "unchanged", do: :unchanged, else: :changed

    {:ok, reaction_projection(input, command_id, outcome)}
  end

  defp present_reaction({:ok, data}, input, command_id) when is_map(data) do
    present_reaction({:ok, struct(Confirmation, data: data)}, input, command_id)
  end

  defp present_reaction(error, _input, _command_id), do: error

  defp reaction_projection(input, command_id, outcome) do
    input
    |> Map.put(:command_id, command_id)
    |> Map.put(:reaction_outcome, outcome)
  end

  @doc """
  Returns paged users for an already-scoped Article collect set.

  ## Examples

      Reactions.Collect.users(article, %{page: 1, size: 20})

  """
  @spec users(struct(), map()) :: {:ok, term()} | {:error, term()}
  def users(article, filter) when is_map(filter) do
    case Matcher.match_interaction(article) do
      {:ok, %{collection?: true}} ->
        Interactions.ReactionUsers.load(ArticleCollect, article, filter)

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

  defp collect_conflict_target(:article_id) do
    {:unsafe_fragment, "(user_id, article_id) WHERE article_id IS NOT NULL AND branch_id IS NULL"}
  end

  defp collect_conflict_target(foreign_key), do: [:user_id, foreign_key]
end
