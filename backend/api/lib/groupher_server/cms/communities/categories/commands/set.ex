defmodule GroupherServer.CMS.Communities.Categories.Commands.Set do
  @moduledoc """
  Associates one Category with an admitted Community.

      Category association -> Gate(:update) -> Persist -> Receipt
  """

  alias GroupherServer.CMS
  alias CMS.{Command, Gate}
  alias CMS.Communities.Categories.{BindingConfirmation, Persist}
  alias CMS.Communities.Categories.Commands.Support
  alias CMS.Model.Community
  alias GroupherServer.Accounts.Model.User
  alias Helper.T

  @spec execute(Community.t() | String.t(), T.id(), User.t(), Ecto.UUID.t()) ::
          T.domain_res(Community.t())
  def execute(community_ref, category_id, %User{} = actor, command_id) do
    with {:ok, community} <- Support.community(community_ref),
         {:ok, category} <- Support.category(category_id) do
      command = %Command{
        actor: actor,
        command_id: command_id,
        operation: :category_set,
        target: community,
        params: %{category_id: category.id}
      }

      with {:ok, confirmation} <-
             Command.execute(command, action: &action/1, confirmation: BindingConfirmation) do
        Support.community_result(confirmation)
      end
    end
  end

  defp action(%{
         actor: actor,
         target: community,
         params: %{category_id: category_id},
         command_id: command_id
       }) do
    with {:ok, category} <- Support.category(category_id),
         {:ok, _} <-
           Gate.with_community_check(actor, :category_set, community, fn canonical ->
             Persist.set_category(canonical, category)
           end) do
      {:ok, Support.confirmation(BindingConfirmation, "community_id", community.id, command_id)}
    end
  end
end
