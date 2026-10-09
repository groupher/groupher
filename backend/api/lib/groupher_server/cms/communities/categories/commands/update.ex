defmodule GroupherServer.CMS.Communities.Categories.Commands.Update do
  @moduledoc """
  Updates a Category inside its admitted Community scope.

      Category Command -> Gate(:update) -> Categories.Persist -> Receipt
  """

  alias GroupherServer.CMS
  alias CMS.{Command, Gate}
  alias CMS.Communities.Categories.{Confirmation, Persist}
  alias CMS.Communities.Categories.Commands.Support
  alias CMS.Model.Category
  alias GroupherServer.Accounts.Model.User
  alias Helper.T

  @spec execute(String.t(), map(), User.t(), Ecto.UUID.t()) :: T.domain_res(Category.t())
  def execute(community_ref, %{id: id} = attrs, %User{} = actor, command_id) do
    with {:ok, community} <- Support.community(community_ref),
         {:ok, category} <- Support.category(id),
         true <- Persist.category_in_community?(community, category) do
      command = %Command{
        actor: actor,
        command_id: command_id,
        operation: :category_update,
        target: category,
        params: %{community_id: community.id, attrs: Map.drop(attrs, [:id, "id"])}
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

  defp action(%{actor: actor, target: category, params: %{community_id: community_id, attrs: attrs}, command_id: command_id}) do
    with {:ok, community} <- Support.community(community_id),
         {:ok, _} <-
           Gate.with_community_check(actor, :category_update, community, fn canonical ->
             with true <- Persist.category_in_community?(canonical, category),
                  {:ok, _updated} <- Persist.update_category(category, attrs) do
               {:ok, :pass}
             else
               false -> {:error, CMS.Communities.ErrorCat.forbidden()}
             end
           end) do
      {:ok, Support.confirmation(Confirmation, "category_id", category.id, command_id)}
    end
  end
end
