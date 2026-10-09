defmodule GroupherServer.CMS.Communities.Moderators.Commands.Add do
  @moduledoc """
  Adds one moderator through the receipt-backed Moderator Command boundary.

      addModerator(commandId)
        -> Add Command
        -> Gate / Moderators.Persist
        -> Confirmation
  """

  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS.Communities.Moderators.{Persist, Commands.Support}
  alias GroupherServer.CMS.Model.Community
  alias Helper.T

  @spec execute(Community.t(), User.t(), User.t(), Ecto.UUID.t()) ::
          T.domain_res(Community.t())
  def execute(%Community{} = community, %User{} = target, %User{} = actor, command_id) do
    Support.execute(
      :moderator_add,
      community,
      actor,
      %{target_user_id: target.id},
      command_id,
      fn canonical ->
        Persist.add(canonical, target)
      end
    )
  end
end
