defmodule GroupherServer.CMS.Communities.Moderators.Commands.Remove do
  @moduledoc """
  Removes one moderator through a `receipt_pipeline`.

      removeModerator(commandId)
        -> Remove Command
        -> Gate / Moderators.Persist
        -> Confirmation
  """

  use GroupherServer.CommandPipeline,
    adapter: GroupherServer.CMS.CommandPipelineAdapter

  alias GroupherServer.{CMS, Accounts}

  alias Accounts.Model.User
  alias CMS.Communities.Moderators.{Persist, Commands.Support}
  alias CMS.Model.Community
  alias Helper.T

  @spec execute(Community.t(), User.t(), User.t(), Ecto.UUID.t()) ::
          T.domain_res(Community.t())
  def execute(%Community{} = community, %User{} = target, %User{} = actor, command_id) do
    execute_pipeline(community, community.id, target, target.id, actor, command_id)
  end

  @pipeline operation: :moderator_remove,
            confirmation: CMS.Communities.Moderators.Commands.Confirmation,
            target: :community,
            params: [:community_id, :target_user_id]

  receipt_pipeline execute_pipeline(
                     community,
                     community_id,
                     target,
                     target_user_id,
                     actor,
                     command_id
                   ) do
    gate(fn candidate -> Support.check_in_transaction(actor, candidate) end)
    change(fn canonical, _operation_ref -> Persist.remove(canonical, target) end)

    confirm(fn result ->
      Support.confirmation(community, command_id, result, %{target_user_id: target_user_id})
    end)

    present(fn confirmation -> Support.present_confirmation(confirmation) end)
  end
end
