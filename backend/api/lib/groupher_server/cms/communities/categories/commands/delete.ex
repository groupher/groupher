defmodule GroupherServer.CMS.Communities.Categories.Commands.Delete do
  @moduledoc """
  Deletes a Category through a `receipt_pipeline` in Community scope.

      Category Command -> Gate(:update) -> Categories.Persist.delete -> Receipt
  """

  use GroupherServer.CommandPipeline,
    adapter: GroupherServer.CMS.CommandPipelineAdapter

  alias GroupherServer.{Accounts, CMS}

  alias CMS.Gate
  alias CMS.Communities.Categories.{Confirmation, Persist}
  alias CMS.Communities.Categories.Commands.Support
  alias CMS.Model.Category
  alias Accounts.Model.User
  alias Helper.T

  @spec execute(String.t(), T.id(), User.t(), Ecto.UUID.t()) :: T.domain_res(Category.t())
  def execute(community_ref, id, %User{} = actor, command_id) do
    case Support.community(community_ref) do
      {:ok, community} ->
        execute_pipeline({:category, id}, community, community.id, actor, command_id)

      {:error, _reason} = error ->
        error
    end
  end

  @pipeline operation: :category_delete,
            confirmation: Confirmation,
            target: :category_target,
            params: [:community_id]

  receipt_pipeline execute_pipeline(category_target, community, community_id, actor, command_id) do
    gate(fn _candidate ->
      {:category, category_id} = category_target

      with {:ok, category} <- Support.category(category_id),
           {:ok, canonical} <- Gate.check_in_transaction(actor, :category_delete, community) do
        {:ok, {canonical, category}}
      end
    end)

    change(fn {canonical, category}, _operation_ref ->
      with true <- Persist.category_in_community?(canonical, category),
           {:ok, deleted} <- Persist.delete_category(category) do
        {:ok, deleted}
      else
        false -> {:error, CMS.Communities.ErrorCat.forbidden()}
      end
    end)

    confirm(fn category ->
      {:ok, Support.confirmation(Confirmation, "category_id", category.id, command_id)}
    end)

    present(fn confirmation -> Support.category_result(confirmation) end)
  end
end
