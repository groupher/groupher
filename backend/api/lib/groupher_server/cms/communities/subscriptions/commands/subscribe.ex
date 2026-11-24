defmodule GroupherServer.CMS.Communities.Subscriptions.Commands.Subscribe do
  @moduledoc """
  User subscription Command implemented as a `receipt_pipeline`.

      GraphQL -> Subscribe -> Gate -> Persist -> Receipt -> Community result
  """

  use GroupherServer.CommandPipeline,
    adapter: GroupherServer.CMS.CommandPipelineAdapter

  alias GroupherServer.{Accounts, CMS}
  alias Accounts.Model.User
  alias CMS.{Communities, Gate}
  alias CMS.Communities.Subscriptions.{Confirmation, Persist}
  alias CMS.Communities.Subscriptions.Commands.Support
  alias CMS.Model.Community
  alias Helper.T

  @doc "Subscribes the actor to a Community through the retry-safe command pipeline."
  @spec execute(Community.t() | String.t(), User.t(), Ecto.UUID.t()) ::
          T.domain_res(Community.t())
  def execute(community_ref, %User{} = actor, command_id) do
    with {:ok, community} <- Support.community(community_ref) do
      execute_pipeline(community, community.id, actor, command_id)
    end
  end

  @pipeline operation: :community_subscribe,
            confirmation: Confirmation,
            target: :community,
            params: [:community_id]

  receipt_pipeline execute_pipeline(community, community_id, actor, command_id) do
    gate(fn candidate -> Gate.check_in_transaction(actor, :read, candidate) end)

    change(fn canonical, _operation_ref ->
      with {:ok, _} <- Persist.subscribe(canonical, actor),
           {:ok, _} <- Communities.Count.update(canonical, actor, :subscribers_count, :inc),
           {:ok, _} <- Accounts.profiles_update_subscribe_state(actor) do
        {:ok, canonical}
      end
    end)

    confirm(fn canonical ->
      {:ok, Support.confirmation(Confirmation, canonical.id, command_id)}
    end)

    present(fn confirmation ->
      with {:ok, community} <- Support.community_result(confirmation) do
        GroupherServer.FrontDesk.revalidate_user(actor.login)
        {:ok, community}
      end
    end)
  end
end
