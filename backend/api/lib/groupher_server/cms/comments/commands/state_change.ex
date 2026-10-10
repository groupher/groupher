defmodule GroupherServer.CMS.Comments.Commands.StateChange do
  @moduledoc """
  Applies one independent Comment state change to a canonical resource.

      state command -> canonical Comment -> state transition -> tagged result
  """

  alias GroupherServer.{CMS, Repo}
  alias CMS.{Command, FrontDesk}
  alias CMS.Comments.States
  alias CMS.Comments.Commands.StateConfirmation, as: Confirmation
  alias GroupherServer.CMS.Model.Comment
  alias GroupherServer.Accounts.Model.User

  @spec execute(atom(), Comment.t(), User.t()) :: {:ok, term()} | {:error, term()}
  def execute(action, %Comment{} = _comment, %User{} = _user)
      when action in [:pin, :undo_pin] do
    {:error, CMS.ErrorCat.command_id_required()}
  end

  def execute(action, %Comment{} = comment, %User{} = user)
      when action in [:fold, :unfold] do
    apply(States, action, [comment, user])
  end

  @spec execute(atom(), Comment.t(), User.t(), Ecto.UUID.t()) ::
          {:ok, Comment.t()} | {:error, term()}
  def execute(action, %Comment{} = comment, %User{} = actor, command_id)
      when action in [:pin, :undo_pin] do
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
  def execute(action, comment_id, %User{} = actor, command_id)
      when action in [:pin, :undo_pin] do
    with {:ok, comment} <- FrontDesk.comment(comment_id, mode: :internal) do
      execute(action, comment, actor, command_id)
    end
  end

  defp change_action(
         %{actor: actor, target: comment, command_id: command_id},
         action
       ) do
    CMS.Gate.with_check(actor, :pin, comment, fn canonical, article ->
      with {:ok, changed} <-
             States.apply_in_transaction(action, canonical, article, actor, command_id) do
        {:ok, confirmation(changed, article, command_id, action)}
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

  defp present(%Confirmation{
         data: %{"comment_id" => comment_id, "command_id" => command_id, "state" => state}
       }) do
    with %Comment{} = comment <- Repo.get(Comment, comment_id) do
      {:ok, comment |> Map.put(:is_pinned, state == "pinned") |> Map.put(:command_id, command_id)}
    else
      nil -> {:error, CMS.Gate.ErrorCat.resource_not_found()}
    end
  end

  defp operation(:pin), do: :comment_pin
  defp operation(:undo_pin), do: :comment_unpin
  defp state(:pin), do: "pinned"
  defp state(:undo_pin), do: "unpinned"
end
