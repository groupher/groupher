defmodule GroupherServer.CMS.Communities.Tags.Commands.ReindexTagGroups do
  @moduledoc """
  Reindexes tag groups as a one-shot, Gate-admitted mutation.

      GraphQL -> ReindexTagGroups -> Gate -> Tags batch update + taxonomy Outbox
  """

  alias GroupherServer.CMS
  alias CMS.Gate
  alias CMS.Communities.Tags.Commands.TagSupport
  alias CMS.Communities.Tags.Mutation
  alias CMS.Model.Community
  alias GroupherServer.Accounts.Model.User
  alias Helper.T

  @spec execute(Community.t() | String.t(), atom(), list(), User.t(), Ecto.UUID.t()) ::
          T.domain_res(atom())
  def execute(community_ref, thread, groups, %User{} = actor, command_id) do
    with {:ok, command_id} <- TagSupport.command_id(command_id),
         {:ok, community} <- TagSupport.community(community_ref) do
      Gate.with_community_check(actor, :update, community, fn canonical ->
        Mutation.reindex_groups(canonical, thread, groups, command_id: command_id)
      end)
    end
  end
end
