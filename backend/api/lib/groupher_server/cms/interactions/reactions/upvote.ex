defmodule GroupherServer.CMS.Interactions.Reactions.Upvote do
  @moduledoc """
  Owns the complete idempotent Article and Comment upvote flow.

      CMS.Interactions
        -> Gate canonical Artiment
        -> authoritative upvote row changed/unchanged
        -> Projection in the same transaction
        -> post-commit events and search metrics
  """

  use GroupherServer.CommandPipeline,
    adapter: GroupherServer.CMS.CommandPipelineAdapter

  import Ecto.Query

  alias GroupherServer.{Accounts, CMS, Repo}

  alias Accounts.Model.User
  alias CMS.Artiment.Matcher
  alias CMS.{Gate, Interactions}
  alias Interactions.{Config, Effects, ErrorCat, Persist, Projection}
  alias CMS.Interactions.Reactions.UpvoteConfirmation, as: Confirmation
  alias CMS.Model.{ArticleUpvote, Author, Comment, CommentUpvote}

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
    execute_add(artiment, :add, actor, command_id)
  end

  @doc """
  Removes an upvote as an idempotent set-state command.

  ## Examples

      Reactions.Upvote.remove(canonical_input, actor)

  """
  @spec remove(struct(), User.t(), Ecto.UUID.t()) :: T.domain_res(struct())
  def remove(artiment, %User{} = actor, command_id) do
    execute_remove(artiment, :remove, actor, command_id)
  end

  @pipeline operation: :upvote_add,
            confirmation: Confirmation,
            target: :input,
            params: [:operation]

  receipt_pipeline execute_add(input, operation, actor, command_id) do
    prepare(fn -> Matcher.match_interaction(input) end)
    gate(fn info -> gate_target(input, info, actor) end)

    change(fn {canonical, info} ->
      change_upvote(canonical, info, actor, operation, command_id)
    end)

    confirm(fn {canonical, change} -> confirmation(canonical, operation, change) end)
    present(fn confirmation -> present_reaction(confirmation, input, command_id) end)
  end

  @pipeline operation: :upvote_remove,
            confirmation: Confirmation,
            target: :input,
            params: [:operation]

  receipt_pipeline execute_remove(input, operation, actor, command_id) do
    prepare(fn -> Matcher.match_interaction(input) end)
    gate(fn info -> gate_target(input, info, actor) end)

    change(fn {canonical, info} ->
      change_upvote(canonical, info, actor, operation, command_id)
    end)

    confirm(fn {canonical, change} -> confirmation(canonical, operation, change) end)
    present(fn confirmation -> present_reaction(confirmation, input, command_id) end)
  end

  defp gate_target(input, info, actor) do
    with {:ok, canonical} <- Gate.check_interaction_in_transaction(actor, :upvote, input) do
      {:ok, {canonical, info}}
    end
  end

  defp change_upvote(canonical, info, actor, operation, command_id) do
    with {:ok, change} <- change_fact(canonical, info, actor, operation),
         {:ok, _} <- sync_state(canonical, actor, operation, change),
         {:ok, _} <- record_metric(canonical, operation, change, command_id),
         {:ok, _} <- maybe_achieve(canonical, actor, operation, change),
         {:ok, _} <- enqueue_effect(canonical, operation, actor, command_id, change) do
      {:ok, {canonical, change}}
    end
  end

  defp confirmation(canonical, operation, change) do
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

  defp sync_state(_canonical, _actor, _operation, :unchanged), do: {:ok, :pass}

  defp sync_state(canonical, actor, operation, :changed) do
    result =
      if operation == :add do
        Projection.add_upvote(canonical, actor)
      else
        Projection.remove_upvote(canonical, actor)
      end

    case result do
      {:ok, _projection} -> {:ok, :pass}
      {:error, _reason} = error -> error
    end
  end

  defp record_metric(%Comment{}, _operation, _change, _operation_id), do: {:ok, :pass}
  defp record_metric(_article, _operation, :unchanged, _operation_id), do: {:ok, :pass}

  defp record_metric(article, operation, :changed, operation_id) do
    metric = if operation == :add, do: :upvote_added, else: :upvote_removed

    case GroupherServer.Analysis.metric_event_append_article_action(article, operation_id, metric) do
      {:ok, _} -> {:ok, :pass}
      {:error, _reason} = error -> error
    end
  end

  defp maybe_achieve(%Comment{}, _actor, _operation, _change), do: {:ok, :pass}
  defp maybe_achieve(_article, _actor, _operation, :unchanged), do: {:ok, :pass}
  defp maybe_achieve(_article, _actor, :remove, :changed), do: {:ok, :pass}

  defp maybe_achieve(article, _actor, :add, :changed) do
    case Accounts.achievements_achieve(author_user(article), :inc, :upvote) do
      {:ok, _achievement} -> {:ok, :pass}
      {:error, _reason} = error -> error
    end
  end

  defp enqueue_effect(_canonical, _operation, _actor, _command_id, :unchanged), do: {:ok, :pass}

  defp enqueue_effect(canonical, operation, actor, command_id, :changed) do
    with {:ok, data} <-
           Effects.reaction_data(canonical, %{actor_id: actor.id, operation: operation}) do
      Effects.enqueue_reaction_changed(
        "interaction.upvote_changed",
        interaction_resource_type(canonical),
        canonical.id,
        command_id,
        data
      )
    end
  end

  defp interaction_resource_type(%Comment{}), do: "comment"
  defp interaction_resource_type(_article), do: "article"

  defp author_user(%{author: %{user_id: user_id}}), do: %User{id: user_id}
  defp author_user(%{author_id: author_id}), do: %User{id: Repo.get!(Author, author_id).user_id}

  defp present_reaction(%Confirmation{data: data}, input, command_id) do
    outcome = if data["outcome"] == "unchanged", do: :unchanged, else: :changed
    {:ok, put_reaction_metadata(input, command_id, outcome)}
  end

  defp present_reaction(data, input, command_id) when is_map(data) do
    present_reaction(%Confirmation{data: data}, input, command_id)
  end

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
  @spec users(struct(), GroupherServer.Pagi.Params.t() | nil) :: {:ok, term()} | {:error, term()}
  def users(article, pagi) do
    case Matcher.match_interaction(article) do
      {:ok, %{artiment: artiment}} when artiment in @article_threads ->
        Interactions.ReactionUsers.load(ArticleUpvote, article, pagi)

      _ ->
        {:error, ErrorCat.unsupported_artiment("upvoted_users only supports Article")}
    end
  end

  defp change_fact(%Comment{} = comment, _info, actor, :add) do
    Persist.insert_fact(
      CommentUpvote,
      %{comment_id: comment.id, user_id: actor.id},
      [:user_id, :comment_id],
      "upvote"
    )
  end

  defp change_fact(%Comment{} = comment, _info, actor, :remove) do
    Persist.delete_fact(
      from(upvote in CommentUpvote,
        where: upvote.comment_id == ^comment.id and upvote.user_id == ^actor.id
      ),
      "upvote"
    )
  end

  defp change_fact(article, info, actor, :add) do
    attrs =
      %{user_id: actor.id, thread: info.artiment}
      |> Map.put(info.foreign_key, article.id)

    Persist.insert_fact(ArticleUpvote, attrs, article_conflict_target(info.foreign_key), "upvote")
  end

  defp change_fact(article, info, actor, :remove) do
    foreign_key = info.foreign_key

    Persist.delete_fact(
      from(upvote in ArticleUpvote,
        where: field(upvote, ^foreign_key) == ^article.id and upvote.user_id == ^actor.id
      ),
      "upvote"
    )
  end

  defp article_conflict_target(:article_id) do
    {:unsafe_fragment, "(user_id, article_id) WHERE article_id IS NOT NULL AND branch_id IS NULL"}
  end

  defp article_conflict_target(foreign_key), do: [:user_id, foreign_key]
end
