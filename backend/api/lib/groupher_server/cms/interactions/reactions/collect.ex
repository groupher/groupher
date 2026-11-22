defmodule GroupherServer.CMS.Interactions.Reactions.Collect do
  @moduledoc """
  Owns the complete idempotent Article collect flow.

      CMS.Interactions
        -> Gate canonical Article
        -> collect fact changed/unchanged
        -> Interaction State and author achievement in one transaction
        -> post-commit notification
  """

  use GroupherServer.CommandPipeline,
    adapter: GroupherServer.CMS.CommandPipelineAdapter

  alias GroupherServer.{Accounts, CMS}
  alias Accounts.Model.User
  alias CMS.Artiment.Matcher
  alias CMS.{Gate, Interactions}
  alias CMS.Interactions.ErrorCat
  alias CMS.Interactions.Reactions.{CollectChange, CollectConfirmation}
  alias CMS.Model.ArticleCollect

  alias Helper.T

  @doc """
  Collects an Article as an idempotent set-state command.

  ## Examples

      Reactions.Collect.add(article, actor)

  """
  @spec add(struct(), User.t(), Ecto.UUID.t()) :: T.domain_res(struct())
  def add(article, %User{} = actor, command_id) do
    execute_add(article, :add, actor, command_id)
  end

  @doc """
  Removes an Article collect as an idempotent set-state command.

  ## Examples

      Reactions.Collect.remove(article, actor)

  """
  @spec remove(struct(), User.t(), Ecto.UUID.t()) :: T.domain_res(struct())
  def remove(article, %User{} = actor, command_id) do
    execute_remove(article, :remove, actor, command_id)
  end

  @pipeline operation: :reaction_collect_add,
            confirmation: CollectConfirmation,
            target: :input,
            params: [:operation]

  receipt_pipeline execute_add(input, operation, actor, command_id) do
    prepare(fn -> Matcher.match_interaction(input) end)
    gate(fn info -> gate_target(input, info, actor) end)

    change(fn {canonical, _info}, operation_ref ->
      CollectChange.apply(canonical, actor, operation, operation_ref)
    end)

    confirm(fn {canonical, change} -> confirmation(canonical, operation, change) end)
    present(fn confirmation -> present_reaction(confirmation, input, command_id) end)
  end

  @pipeline operation: :reaction_collect_remove,
            confirmation: CollectConfirmation,
            target: :input,
            params: [:operation]

  receipt_pipeline execute_remove(input, operation, actor, command_id) do
    prepare(fn -> Matcher.match_interaction(input) end)
    gate(fn info -> gate_target(input, info, actor) end)

    change(fn {canonical, _info}, operation_ref ->
      CollectChange.apply(canonical, actor, operation, operation_ref)
    end)

    confirm(fn {canonical, change} -> confirmation(canonical, operation, change) end)
    present(fn confirmation -> present_reaction(confirmation, input, command_id) end)
  end

  defp gate_target(input, info, actor) do
    with %{collection?: true} <- info,
         {:ok, canonical} <- Gate.check_interaction_in_transaction(actor, :collect, input),
         {:ok, %{collection?: true} = canonical_info} <- Matcher.match_interaction(canonical) do
      {:ok, {canonical, canonical_info}}
    else
      %{collection?: false} -> {:error, ErrorCat.unsupported_artiment("Comment")}
      {:ok, %{collection?: false}} -> {:error, ErrorCat.unsupported_artiment("Comment")}
      {:error, _reason} = error -> error
    end
  end

  defp confirmation(canonical, operation, change) do
    {:ok,
     %CollectConfirmation{
       data: %{
         "target_id" => to_string(canonical.id),
         "target_type" => "article",
         "operation" => Atom.to_string(operation),
         "outcome" => Atom.to_string(change)
       }
     }}
  end

  defp present_reaction(%CollectConfirmation{data: data}, input, command_id) do
    outcome = if data["outcome"] == "unchanged", do: :unchanged, else: :changed

    {:ok, reaction_projection(input, command_id, outcome)}
  end

  defp present_reaction(data, input, command_id) when is_map(data) do
    present_reaction(struct(CollectConfirmation, data: data), input, command_id)
  end

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
  @spec users(struct(), GroupherServer.Pagi.Params.t() | nil) :: {:ok, term()} | {:error, term()}
  def users(article, pagi) do
    case Matcher.match_interaction(article) do
      {:ok, %{collection?: true}} ->
        Interactions.ReactionUsers.load(ArticleCollect, article, pagi)

      _ ->
        {:error, ErrorCat.unsupported_artiment("collected_users only supports Article")}
    end
  end
end
