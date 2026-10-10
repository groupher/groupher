defmodule GroupherServer.CMS.Communities.Moderators.Commands.AddMany do
  @moduledoc """
  Adds many moderators with one Receipt and a per-target result summary.

      addModerators(commandId)
        -> AddMany Command
        -> one root transaction
        -> per-target ok/error summary
  """

  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS.Communities.Moderators.{Persist, Commands.Support}
  alias GroupherServer.CMS.Model.Community
  alias Helper.T

  @spec execute(Community.t(), [User.t()], User.t(), Ecto.UUID.t()) ::
          T.domain_res(Community.t())
  def execute(%Community{} = community, targets, %User{} = actor, command_id)
      when is_list(targets) do
    Support.execute(
      :moderator_add_many,
      community,
      actor,
      %{target_user_ids: Enum.map(targets, & &1.id)},
      command_id,
      fn canonical ->
        Persist.add_many(canonical, targets)
      end
    )
  end
end
