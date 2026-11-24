defmodule GroupherServer.CMS.Communities.Categories.Commands.Update do
  @moduledoc """
  Updates a Category inside its admitted Community scope.

      Category Command -> Gate(:update) -> Categories.Persist -> Receipt
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

  @doc "Updates a category through the retry-safe command pipeline."
  @spec execute(String.t(), map(), User.t(), Ecto.UUID.t()) :: T.domain_res(Category.t())
  def execute(community_ref, %{id: id} = attrs, %User{} = actor, command_id) do
    case Support.community(community_ref) do
      {:ok, community} ->
        execute_pipeline(
          {:category, id},
          community,
          community.id,
          Map.drop(attrs, [:id, "id"]),
          actor,
          command_id
        )

      {:error, _reason} = error ->
        error
    end
  end

  @pipeline operation: :category_update,
            confirmation: Confirmation,
            target: :category_target,
            params: [:community_id, :attrs]

  receipt_pipeline execute_pipeline(
                     category_target,
                     community,
                     community_id,
                     attrs,
                     actor,
                     command_id
                   ) do
    gate(fn _candidate ->
      {:category, category_id} = category_target

      with {:ok, category} <- Support.category(category_id),
           {:ok, canonical} <- Gate.check_in_transaction(actor, :category_update, community) do
        {:ok, {canonical, category}}
      end
    end)

    change(fn {canonical, category}, _operation_ref ->
      with true <- Persist.category_in_community?(canonical, category),
           {:ok, updated} <- Persist.update_category(category, attrs) do
        {:ok, updated}
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
