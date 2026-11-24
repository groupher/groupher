defmodule GroupherServer.CMS.Communities.Subscriptions.Commands.Unsubscribe do
  @moduledoc """
  User unsubscribe Command implemented as a `receipt_pipeline`.

      GraphQL -> Unsubscribe -> Gate -> Persist -> Receipt -> Community result
  """

  use GroupherServer.CommandPipeline,
    adapter: GroupherServer.CMS.CommandPipelineAdapter

  alias GroupherServer.{Accounts, CMS}
  alias Accounts.Model.User
  alias CMS.{Communities, Gate}
  alias CMS.Communities.{ErrorCat, Subscriptions.Commands.Support}
  alias CMS.Communities.Subscriptions.{Confirmation, Persist}
  alias CMS.Model.Community
  alias Helper.T

  @doc "Removes the actor's Community subscription through the command pipeline."
  @spec execute(Community.t() | String.t(), User.t(), Ecto.UUID.t()) ::
          T.domain_res(Community.t())
  def execute(community_ref, %User{} = actor, command_id) do
    with {:ok, community} <- Support.community(community_ref) do
      execute_pipeline(community, community.id, actor, command_id)
    end
  end

  @pipeline operation: :community_unsubscribe,
            confirmation: Confirmation,
            target: :community,
            params: [:community_id]

  receipt_pipeline execute_pipeline(community, community_id, actor, command_id) do
    gate(fn candidate ->
      if candidate.slug == "home" do
        {:error, ErrorCat.custom("can not unsubscribe home community")}
      else
        Gate.check_in_transaction(actor, :read, candidate)
      end
    end)

    change(fn canonical, _operation_ref ->
      with true <- Persist.subscribed?(canonical, actor),
           {:ok, _} <- Persist.unsubscribe(canonical, actor),
           {:ok, _} <- Communities.Count.update(canonical, actor, :subscribers_count, :dec),
           {:ok, _} <- Accounts.profiles_update_subscribe_state(actor) do
        {:ok, canonical}
      else
        false -> {:error, ErrorCat.custom("community subscription not found")}
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
