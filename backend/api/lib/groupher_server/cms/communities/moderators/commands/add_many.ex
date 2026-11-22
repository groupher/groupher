defmodule GroupherServer.CMS.Communities.Moderators.Commands.AddMany do
  @moduledoc """
  Adds many moderators with one Receipt and a per-target result summary.

      addModerators(commandId)
        -> AddMany Command
        -> one root transaction
        -> per-target ok/error summary
  """

  use GroupherServer.CommandPipeline,
    adapter: GroupherServer.CMS.CommandPipelineAdapter

  alias GroupherServer.{CMS, Accounts}

  alias Accounts.Model.User
  alias CMS.Communities.Moderators.{Persist, Commands.Support}
  alias CMS.Model.Community
  alias Helper.T

  @spec execute(Community.t(), [User.t()], User.t(), Ecto.UUID.t()) ::
          T.domain_res(Community.t())
  def execute(%Community{} = community, targets, %User{} = actor, command_id)
      when is_list(targets) do
    target_user_ids = Enum.map(targets, & &1.id)
    execute_pipeline(community, community.id, targets, target_user_ids, actor, command_id)
  end

  @pipeline operation: :moderator_add_many,
            confirmation: CMS.Communities.Moderators.Commands.Confirmation,
            target: :community,
            params: [:community_id, :target_user_ids]

  receipt_pipeline execute_pipeline(
                     community,
                     community_id,
                     targets,
                     target_user_ids,
                     actor,
                     command_id
                   ) do
    gate(fn candidate -> Support.check_in_transaction(actor, candidate) end)
    change(fn canonical, _operation_ref -> Persist.add_many(canonical, targets) end)

    confirm(fn result ->
      Support.confirmation(community, command_id, result, %{target_user_ids: target_user_ids})
    end)

    present(fn confirmation -> Support.present_confirmation(confirmation) end)
  end
end
