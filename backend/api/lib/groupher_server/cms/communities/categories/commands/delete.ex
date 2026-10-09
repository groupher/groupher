defmodule GroupherServer.CMS.Communities.Categories.Commands.Delete do
  @moduledoc """
  Deletes a Category through the receipt-backed Community scope.

      Category Command -> Gate(:update) -> Categories.Persist.delete -> Receipt
  """

  alias GroupherServer.CMS
  alias CMS.{Command, Gate}
  alias CMS.Communities.Categories.{Confirmation, Persist}
  alias CMS.Communities.Categories.Commands.Support
  alias CMS.Model.Category
  alias GroupherServer.Accounts.Model.User
  alias Helper.T

  @spec execute(String.t(), T.id(), User.t(), Ecto.UUID.t()) :: T.domain_res(Category.t())
  def execute(community_ref, id, %User{} = actor, command_id) do
    with {:ok, community} <- Support.community(community_ref),
         {:ok, category} <- Support.category(id),
         true <- Persist.category_in_community?(community, category) do
      command = %Command{
        actor: actor,
        command_id: command_id,
        operation: :category_delete,
        target: category,
        params: %{community_id: community.id}
      }

      with {:ok, confirmation} <-
             Command.execute(command, action: &action/1, confirmation: Confirmation) do
        Support.category_result(confirmation)
      end
    else
      false -> {:error, CMS.Communities.ErrorCat.forbidden()}
      {:error, _reason} = error -> error
    end
  end

  defp action(%{actor: actor, target: category, params: %{community_id: community_id}, command_id: command_id}) do
    with {:ok, community} <- Support.community(community_id),
         {:ok, _deleted} <-
           Gate.with_community_check(actor, :category_delete, community, fn canonical ->
             with true <- Persist.category_in_community?(canonical, category),
                  {:ok, deleted} <- Persist.delete_category(category) do
               {:ok, deleted}
             else
               false -> {:error, CMS.Communities.ErrorCat.forbidden()}
             end
           end) do
      {:ok, Support.confirmation(Confirmation, "category_id", category.id, command_id)}
    end
  end
end
