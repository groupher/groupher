defmodule GroupherServer.CMS.Communities.Tags.Commands.ReindexTagsInGroup do
  @moduledoc """
  Reindexes one tag group as a one-shot, Gate-admitted mutation.

      GraphQL -> ReindexTagsInGroup -> Gate -> Tags batch update + taxonomy Outbox
  """

  alias GroupherServer.CMS
  alias CMS.{Gate}
  alias CMS.Communities.Tags.Commands.TagSupport
  alias CMS.Communities.Tags.Mutation
  alias CMS.Model.Community
  alias GroupherServer.Accounts.Model.User
  alias Helper.T

  @spec execute(Community.t() | String.t(), atom(), T.id(), list(), User.t(), Ecto.UUID.t()) ::
          T.domain_res(atom())
  def execute(community_ref, thread, group_id, tags, %User{} = actor, command_id) do
    with {:ok, command_id} <- TagSupport.command_id(command_id),
         {:ok, community} <- TagSupport.community(community_ref) do
      Gate.with_community_check(actor, :update, community, fn canonical ->
        Mutation.reindex_in_group(canonical, thread, group_id, tags, command_id: command_id)
      end)
    end
  end
end
