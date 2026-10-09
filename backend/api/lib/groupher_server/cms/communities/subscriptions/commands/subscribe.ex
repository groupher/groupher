defmodule GroupherServer.CMS.Communities.Subscriptions.Commands.Subscribe do
  @moduledoc """
  Receipt-backed user subscription command.

      GraphQL -> Subscribe -> Gate -> Persist -> Receipt -> Community result
  """

  alias GroupherServer.{Accounts, CMS}
  alias Accounts.Model.User
  alias CMS.{Command, Gate}
  alias CMS.Communities
  alias CMS.Communities.Subscriptions.{Confirmation, Persist}
  alias CMS.Communities.Subscriptions.Commands.Support
  alias CMS.Model.Community
  alias Helper.T

  @spec execute(Community.t() | String.t(), User.t(), Ecto.UUID.t()) ::
          T.domain_res(Community.t())
  def execute(community_ref, %User{} = actor, command_id) do
    with {:ok, community} <- Support.community(community_ref) do
      command = %Command{
        actor: actor,
        command_id: command_id,
        operation: :community_subscribe,
        target: community,
        params: %{community_id: community.id}
      }

      with {:ok, confirmation} <-
             Command.execute(command, action: &action/1, confirmation: Confirmation) do
        Support.community_result(confirmation)
      end
    end
  end

  defp action(%{actor: actor, target: community, command_id: command_id}) do
    Gate.with_community_check(actor, :read, community, fn canonical ->
      with {:ok, _} <- Persist.subscribe(canonical, actor),
           {:ok, _} <- Communities.Count.update(canonical, actor, :subscribers_count, :inc),
           {:ok, _} <- Accounts.Profiles.update_subscribe_state(actor) do
        {:ok, Support.confirmation(Confirmation, canonical.id, command_id)}
      end
    end)
  end
end
