defmodule GroupherServer.CMS.Communities.Moderators.Commands.UpdatePassport do
  @moduledoc """
  Replaces one moderator's community passport through a Receipt Command.

      updateModeratorPassport(commandId)
        -> UpdatePassport Command
        -> Gate / passport community match
        -> Confirmation
  """

  use GroupherServer.CommandPipeline,
    adapter: GroupherServer.CMS.CommandPipelineAdapter

  alias GroupherServer.{CMS, Accounts}

  alias Accounts.Model.User
  alias CMS.Communities.Moderators.{Persist, Commands.Support}
  alias CMS.Model.Community
  alias Helper.T

  @spec execute(Community.t(), map(), User.t(), User.t(), Ecto.UUID.t()) ::
          T.domain_res(Community.t())
  def execute(
        %Community{} = community,
        rules,
        %User{} = target,
        %User{} = actor,
        command_id
      ) do
    execute_pipeline(community, community.id, rules, target, target.id, actor, command_id)
  end

  @pipeline operation: :moderator_update,
            confirmation: CMS.Communities.Moderators.Commands.Confirmation,
            target: :community,
            params: [:community_id, :target_user_id, :rules]

  receipt_pipeline execute_pipeline(
                     community,
                     community_id,
                     rules,
                     target,
                     target_user_id,
                     actor,
                     command_id
                   ) do
    gate(fn candidate -> Support.check_in_transaction(actor, candidate) end)
    change(fn canonical, _operation_ref -> Persist.update_passport(canonical, rules, target) end)

    confirm(fn result ->
      Support.confirmation(community, command_id, result, %{
        target_user_id: target_user_id,
        rules: rules
      })
    end)

    present(fn confirmation -> Support.present_confirmation(confirmation) end)
  end
end
