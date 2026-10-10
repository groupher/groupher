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

  alias GroupherServer.{Accounts, CMS, Repo}
  alias Accounts.Model.User
  alias CMS.{Command, FrontDesk}
  alias CMS.Comments.Solution
  alias CMS.Comments.Commands.SolutionConfirmation, as: Confirmation
  alias CMS.Model.Comment

  @actions [:accept_solution, :revoke_solution]

  @spec execute(atom(), Comment.t(), User.t(), Ecto.UUID.t()) ::
          {:ok, Comment.t()} | {:error, term()}
  def execute(action, %Comment{} = comment, %User{} = actor, command_id)
      when action in @actions do
    command = %Command{
      actor: actor,
      command_id: command_id,
      operation: operation(action),
      target: comment,
      params: %{}
    }

    with {:ok, confirmation} <-
           Command.execute(command,
             action: &change_action(&1, action),
             confirmation: Confirmation
           ) do
      present(confirmation)
    end
  end

  @spec execute(atom(), Ecto.UUID.t(), User.t(), Ecto.UUID.t()) ::
          {:ok, Comment.t()} | {:error, term()}
  def execute(action, comment_id, %User{} = actor, command_id) when action in @actions do
    with {:ok, comment} <- FrontDesk.comment(comment_id, mode: :internal) do
      execute(action, comment, actor, command_id)
    end
  end

  defp change_action(
         %{actor: actor, target: comment, command_id: command_id},
         action
       ) do
    CMS.Gate.with_check(actor, gate_action(action), comment, fn canonical, post ->
      with {:ok, changed} <-
             Solution.apply_in_transaction(action, post, canonical, actor, command_id) do
        {:ok, confirmation(changed, post, command_id, action)}
      end
    end)
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

  defp present(%Confirmation{data: %{"comment_id" => comment_id, "state" => state}}) do
    with %Comment{} = comment <- Repo.get(Comment, comment_id) do
      {:ok, %{comment | is_solution: state == "accepted"}}
    else
      nil -> {:error, CMS.Gate.ErrorCat.resource_not_found()}
    end
  end

  defp operation(:accept_solution), do: :comment_accept_solution
  defp operation(:revoke_solution), do: :comment_revoke_solution

  defp gate_action(:accept_solution), do: :accept_solution
  defp gate_action(:revoke_solution), do: :revoke_solution

  defp state(:accept_solution), do: "accepted"
  defp state(:revoke_solution), do: "revoked"
end
