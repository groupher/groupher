defmodule GroupherServer.CMS.Interactions.Reactions.Upvote do
  @moduledoc """
  Owns the complete idempotent Article and Comment upvote flow.

      CMS.Interactions
        -> Gate canonical Artiment
        -> authoritative upvote row changed/unchanged
        -> ReadState in the same transaction
        -> post-commit events and search metrics
  """

  import Ecto.Query

  alias GroupherServer.{Accounts, Analysis, CMS, Repo}

  alias Accounts.Model.User
  alias CMS.Artiment.Matcher
  alias CMS.{Gate, Interactions, Command}
  alias Interactions.{Config, ErrorCat, ReadState}
  alias CMS.Interactions.Reactions.UpvoteConfirmation, as: Confirmation
  alias CMS.Model.{ArticleUpvote, Author, Comment, CommentUpvote}
  alias Analysis.MetricEvent
  alias Helper.T

  @article_threads Config.article_threads()

  @type change :: :changed | :unchanged

  @doc """
  Adds an upvote as an idempotent set-state command.

  ## Examples

      Reactions.Upvote.add(canonical_input, actor)

  """
  @spec add(struct(), User.t(), Ecto.UUID.t()) :: T.domain_res(struct())
  def add(artiment, %User{} = actor, command_id) do
    mutate(artiment, actor, :add, command_id)
  end

  @doc """
  Removes an upvote as an idempotent set-state command.

  ## Examples

      Reactions.Upvote.remove(canonical_input, actor)

  """
  @spec remove(struct(), User.t(), Ecto.UUID.t()) :: T.domain_res(struct())
  def remove(artiment, %User{} = actor, command_id) do
    mutate(artiment, actor, :remove, command_id)
  end

  defp mutate(input, actor, operation, command_id) do
    with {:ok, command_id} <- require_command_id(command_id),
         {:ok, info} <- Matcher.match_interaction(input) do
      result =
        %Command{
          actor: actor,
          command_id: command_id,
          operation: upvote_command(operation),
          target: input,
          params: %{operation: operation}
        }
        |> Command.execute(action: &upvote_action(&1, info), confirmation: Confirmation)

      present_reaction(result, input, command_id)
    end
  end

  defp upvote_action(
         %{
           actor: actor,
           target: input,
           params: %{operation: operation},
           command_id: command_id
         },
         info
       ) do
    with {:ok, canonical} <- Gate.access_check(actor, :upvote, input),
         {:ok, change} <- change_fact(canonical, info, actor, operation),
         {:ok, _} <- sync_state(canonical, actor, operation, change),
         {:ok, _} <- record_metric(canonical, operation, change, command_id),
         {:ok, _} <- maybe_achieve(canonical, actor, operation, change),
         {:ok, _} <- enqueue_effect(canonical, operation, actor, command_id, change) do
      {:ok,
       %Confirmation{
         data: %{
           "target_id" => to_string(canonical.id),
           "target_type" => interaction_resource_type(canonical),
           "operation" => Atom.to_string(operation),
           "outcome" => Atom.to_string(change)
         }
       }}
    end
  end

  defp require_command_id(command_id) when is_binary(command_id), do: {:ok, command_id}
  defp require_command_id(_command_id), do: {:error, CMS.ErrorCat.command_id_required()}

  defp upvote_command(:add), do: :upvote_add
  defp upvote_command(:remove), do: :upvote_remove

  defp sync_state(_canonical, _actor, _operation, :unchanged), do: {:ok, :pass}

  defp sync_state(canonical, actor, operation, :changed) do
    result =
      if operation == :add,
        do: ReadState.add_upvote(canonical, actor),
        else: ReadState.remove_upvote(canonical, actor)

    case result do
      {:ok, _projection} -> {:ok, :pass}
      {:error, _reason} = error -> error
    end
  end

  defp record_metric(%Comment{}, _operation, _change, _operation_id), do: {:ok, :pass}
  defp record_metric(_article, _operation, :unchanged, _operation_id), do: {:ok, :pass}

  defp record_metric(article, operation, :changed, operation_id) do
    metric = if operation == :add, do: :upvote_added, else: :upvote_removed

    case MetricEvent.append_article_action(article, operation_id, metric) do
      {:ok, _} -> {:ok, :pass}
      {:error, _reason} = error -> error
    end
  end

  defp maybe_achieve(%Comment{}, _actor, _operation, _change), do: {:ok, :pass}
  defp maybe_achieve(_article, _actor, _operation, :unchanged), do: {:ok, :pass}
  defp maybe_achieve(_article, _actor, :remove, :changed), do: {:ok, :pass}

  defp maybe_achieve(article, _actor, :add, :changed) do
    case Accounts.Achievements.achieve(author_user(article), :inc, :upvote) do
      {:ok, _achievement} -> {:ok, :pass}
      {:error, _reason} = error -> error
    end
  end

  defp enqueue_effect(_canonical, _operation, _actor, _command_id, :unchanged), do: {:ok, :pass}

  defp enqueue_effect(canonical, operation, actor, command_id, :changed) do
    CMS.Outbox.send(%{
      event: "interaction.upvote_changed",
      worker: CMS.Outbox.Workers.Interaction.Cleanup,
      resource_type: interaction_resource_type(canonical),
      resource_id: canonical.id,
      command_id: command_id,
      data: %{actor_id: actor.id, operation: operation}
    })
    |> case do
      {:ok, _event} -> {:ok, :pass}
      {:error, reason} -> {:error, reason}
    end
  end

  defp interaction_resource_type(%Comment{}), do: "comment"
  defp interaction_resource_type(_article), do: "article"

  defp author_user(%{author: %{user_id: user_id}}), do: %User{id: user_id}
  defp author_user(%{author_id: author_id}), do: %User{id: Repo.get!(Author, author_id).user_id}

  defp present_reaction({:ok, %Confirmation{data: data}}, input, command_id) do
    outcome = if data["outcome"] == "unchanged", do: :unchanged, else: :changed
    {:ok, put_reaction_metadata(input, command_id, outcome)}
  end

  defp present_reaction({:ok, data}, input, command_id) when is_map(data) do
    present_reaction({:ok, %Confirmation{data: data}}, input, command_id)
  end

  defp present_reaction(error, _input, _command_id), do: error

  defp put_reaction_metadata(canonical, command_id, outcome) do
    canonical
    |> Map.put(:command_id, command_id)
    |> Map.put(:reaction_outcome, outcome)
  end

  @doc """
  Returns paged users for an already-scoped Article upvote set.

  ## Examples

      Reactions.Upvote.users(article, %{page: 1, size: 20})

  """
  @spec users(struct(), map()) :: {:ok, term()} | {:error, term()}
  def users(article, filter) when is_map(filter) do
    case Matcher.match_interaction(article) do
      {:ok, %{artiment: artiment}} when artiment in @article_threads ->
        Interactions.ReactionUsers.load(ArticleUpvote, article, filter)

      _ ->
        {:error, ErrorCat.unsupported_artiment("upvoted_users only supports Article")}
    end
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

    insert_fact(ArticleUpvote, attrs, article_conflict_target(info.foreign_key))
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

    case Repo.insert_all(schema, [attrs], on_conflict: :nothing, conflict_target: conflict_target) do
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

  defp article_conflict_target(:article_id) do
    {:unsafe_fragment, "(user_id, article_id) WHERE article_id IS NOT NULL AND branch_id IS NULL"}
  end

  defp article_conflict_target(foreign_key), do: [:user_id, foreign_key]
end
