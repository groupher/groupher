defmodule GroupherServer.CMS.Communities.Categories.Commands.Set do
  @moduledoc """
  Associates one Category with an admitted Community.

      Category association -> Gate(:update) -> Persist -> Receipt
  """

  use GroupherServer.CommandPipeline,
    adapter: GroupherServer.CMS.CommandPipelineAdapter

  alias GroupherServer.{Accounts, CMS}

  alias CMS.Gate
  alias CMS.Communities.Categories.{BindingConfirmation, Persist}
  alias CMS.Communities.Categories.Commands.Support
  alias CMS.Model.Community
  alias Accounts.Model.User
  alias Helper.T

  @spec execute(Community.t() | String.t(), T.id(), User.t(), Ecto.UUID.t()) ::
          T.domain_res(Community.t())
  def execute(community_ref, category_id, %User{} = actor, command_id) do
    with {:ok, community} <- Support.community(community_ref) do
      execute_pipeline(community, category_id, actor, command_id)
    end
  end

  @pipeline operation: :category_set,
            confirmation: BindingConfirmation,
            target: :community,
            params: [:category_id]

  receipt_pipeline execute_pipeline(community, category_id, actor, command_id) do
    gate(fn _candidate ->
      with {:ok, category} <- Support.category(category_id),
           {:ok, canonical} <- Gate.check_in_transaction(actor, :category_set, community) do
        {:ok, {canonical, category}}
      end
    end)

    change(fn {canonical, category}, _operation_ref ->
      Persist.set_category(canonical, category)
    end)

    confirm(fn _result ->
      {:ok, Support.confirmation(BindingConfirmation, "community_id", community.id, command_id)}
    end)

    present(fn confirmation -> Support.community_result(confirmation) end)
  end
end
