defmodule GroupherServer.CMS.Comments.Commands.StateChange do
  @moduledoc """
  Applies one independent Comment state change to a canonical resource.

      state command -> canonical Comment -> state transition -> tagged result
  """

  use GroupherServer.CommandPipeline,
    adapter: GroupherServer.CMS.CommandPipelineAdapter

  alias GroupherServer.{Accounts, CMS}
  alias Accounts.Model.User
  alias CMS.FrontDesk
  alias CMS.Comments.States
  alias CMS.Comments.Commands.StateConfirmation, as: Confirmation
  alias CMS.Model.Comment

  @spec execute(atom(), Comment.t(), User.t()) :: {:ok, term()} | {:error, term()}
  def execute(action, %Comment{} = _comment, %User{} = _user)
      when action in [:pin, :undo_pin] do
    {:error, CMS.ErrorCat.command_id_required()}
  end

  def execute(action, %Comment{} = comment, %User{} = user)
      when action in [:fold, :unfold] do
    with {:ok, community} <- CMS.Comments.RequestCommunity.resolve(comment) do
      case action do
        :fold -> fold_pipeline(comment, user, community)
        :unfold -> unfold_pipeline(comment, user, community)
      end
    end
  end

  @pipeline operation: :comment_fold, target: :comment
  direct_pipeline fold_pipeline(comment, actor, community) do
    gate(fn candidate ->
      CMS.Gate.check_comment_in_transaction(actor, :edit, candidate, community)
    end)

    change(fn {canonical, _article} ->
      States.fold(Map.put(canonical, :request_community_slug, community.slug), actor)
    end)
  end

  @pipeline operation: :comment_unfold, target: :comment
  direct_pipeline unfold_pipeline(comment, actor, community) do
    gate(fn candidate ->
      CMS.Gate.check_comment_in_transaction(actor, :edit, candidate, community)
    end)

    change(fn {canonical, _article} ->
      States.unfold(Map.put(canonical, :request_community_slug, community.slug), actor)
    end)
  end

  @spec execute(atom(), Comment.t(), User.t(), Ecto.UUID.t()) ::
          {:ok, Comment.t()} | {:error, term()}
  def execute(action, %Comment{} = comment, %User{} = actor, command_id)
      when action in [:pin, :undo_pin] do
    with {:ok, community} <- CMS.Comments.RequestCommunity.resolve(comment) do
      case action do
        :pin -> pin_pipeline(comment, actor, command_id, community)
        :undo_pin -> unpin_pipeline(comment, actor, command_id, community)
      end
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

  @pipeline operation: :comment_pin,
            confirmation: Confirmation,
            target: :comment,
            params: []
  receipt_pipeline pin_pipeline(comment, actor, command_id, community) do
    gate(fn candidate ->
      CMS.Gate.check_comment_in_transaction(actor, :pin, candidate, community)
    end)

    change(fn {canonical, article} ->
      canonical = Map.put(canonical, :request_community_slug, community.slug)

      with {:ok, changed} <-
             States.apply_in_transaction(:pin, canonical, article, actor, command_id) do
        {:ok, {changed, article}}
      end
    end)

    confirm(fn {changed, article} ->
      {:ok, confirmation(changed, article, command_id, :pin)}
    end)

    present(fn confirmation -> present_result(confirmation) end)
  end

  @pipeline operation: :comment_unpin,
            confirmation: Confirmation,
            target: :comment,
            params: []
  receipt_pipeline unpin_pipeline(comment, actor, command_id, community) do
    gate(fn candidate ->
      CMS.Gate.check_comment_in_transaction(actor, :undo_pin, candidate, community)
    end)

    change(fn {canonical, article} ->
      canonical = Map.put(canonical, :request_community_slug, community.slug)

      with {:ok, changed} <-
             States.apply_in_transaction(:undo_pin, canonical, article, actor, command_id) do
        {:ok, {changed, article}}
      end
    end)

    confirm(fn {changed, article} ->
      {:ok, confirmation(changed, article, command_id, :undo_pin)}
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

  defp present_result(%Confirmation{
         data: %{"comment_id" => comment_id, "command_id" => command_id, "state" => state}
       }) do
    case FrontDesk.comment(comment_id, mode: :internal) do
      {:ok, %Comment{} = comment} ->
        {:ok,
         comment |> Map.put(:is_pinned, state == "pinned") |> Map.put(:command_id, command_id)}

      {:error, _reason} ->
        {:error, CMS.Gate.ErrorCat.resource_not_found()}
    end
  end

  defp state(:pin), do: "pinned"
  defp state(:undo_pin), do: "unpinned"
end
