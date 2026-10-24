defmodule GroupherServer.CMS.Comments.Commands.SolutionChange do
  @moduledoc """
  Owns the retry-safe Comment solution mutations.

      GraphQL / CMS facade
        -> SolutionChange (command identity + Receipt)
        -> Gate aggregate admission
        -> PostSolution binding + Activity

  The supplied command id is also the Activity operation reference. No second
  UUID is created inside the aggregate callback.
  """

  use GroupherServer.CommandPipeline,
    adapter: GroupherServer.CMS.CommandPipelineAdapter

  alias GroupherServer.{Accounts, CMS}
  alias Accounts.Model.User
  alias CMS.FrontDesk
  alias CMS.Comments.Solution
  alias CMS.Comments.Commands.SolutionConfirmation, as: Confirmation
  alias CMS.Model.Comment

  @actions [:accept_solution, :revoke_solution]

  @spec execute(atom(), Comment.t(), User.t(), Ecto.UUID.t()) ::
          {:ok, Comment.t()} | {:error, term()}
  def execute(action, %Comment{} = comment, %User{} = actor, command_id)
      when action in @actions do
    case action do
      :accept_solution -> accept_pipeline(comment, actor, command_id)
      :revoke_solution -> revoke_pipeline(comment, actor, command_id)
    end
  end

  @spec execute(atom(), Ecto.UUID.t(), User.t(), Ecto.UUID.t()) ::
          {:ok, Comment.t()} | {:error, term()}
  def execute(action, comment_id, %User{} = actor, command_id) when action in @actions do
    with {:ok, comment} <- FrontDesk.comment(comment_id, mode: :internal) do
      execute(action, comment, actor, command_id)
    end
  end

  @pipeline operation: :comment_accept_solution,
            confirmation: Confirmation,
            target: :comment,
            params: []

  receipt_pipeline accept_pipeline(comment, actor, command_id) do
    gate(fn candidate ->
      CMS.Gate.check_comment_in_transaction(actor, :accept_solution, candidate)
    end)

    change(fn {canonical, post} ->
      with {:ok, changed} <-
             Solution.apply_in_transaction(:accept_solution, post, canonical, actor, command_id) do
        {:ok, {changed, post}}
      end
    end)

    confirm(fn {changed, post} ->
      {:ok, confirmation(changed, post, command_id, :accept_solution)}
    end)

    present(fn confirmation -> present_result(confirmation) end)
  end

  @pipeline operation: :comment_revoke_solution,
            confirmation: Confirmation,
            target: :comment,
            params: []

  receipt_pipeline revoke_pipeline(comment, actor, command_id) do
    gate(fn candidate ->
      CMS.Gate.check_comment_in_transaction(actor, :revoke_solution, candidate)
    end)

    change(fn {canonical, post} ->
      with {:ok, changed} <-
             Solution.apply_in_transaction(:revoke_solution, post, canonical, actor, command_id) do
        {:ok, {changed, post}}
      end
    end)

    confirm(fn {changed, post} ->
      {:ok, confirmation(changed, post, command_id, :revoke_solution)}
    end)

    present(fn confirmation -> present_result(confirmation) end)
  end

  defp confirmation(%{id: comment_id}, %{id: article_id}, command_id, action) do
    %Confirmation{
      data: %{
        "article_id" => to_string(article_id),
        "comment_id" => to_string(comment_id),
        "command_id" => command_id,
        "state" => state(action)
      }
    }
  end

  defp present_result(%Confirmation{data: %{"comment_id" => comment_id, "state" => state}}) do
    case FrontDesk.comment(comment_id, mode: :internal) do
      {:ok, %Comment{} = comment} -> {:ok, %{comment | is_solution: state == "accepted"}}
      {:error, _reason} -> {:error, CMS.Gate.ErrorCat.resource_not_found()}
    end
  end

  defp state(:accept_solution), do: "accepted"
  defp state(:revoke_solution), do: "revoked"
end
