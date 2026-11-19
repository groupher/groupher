defmodule GroupherServer.CMS.Communities.Tags.Commands.ReindexTagsInGroup do
  @moduledoc """
  Reindexes one tag group through a Gate-admitted `direct_pipeline`.

      GraphQL -> ReindexTagsInGroup -> Gate -> Tags batch update + taxonomy Outbox
  """

  use GroupherServer.CommandPipeline,
    adapter: GroupherServer.CMS.CommandPipelineAdapter

  alias GroupherServer.{Accounts, CMS}

  alias CMS.Gate
  alias CMS.Communities.Tags.Commands.TagSupport
  alias CMS.Communities.Tags.Mutation
  alias CMS.Model.Community
  alias Accounts.Model.User
  alias Helper.T

  @spec execute(Community.t() | String.t(), atom(), T.id(), list(), User.t(), Ecto.UUID.t()) ::
          T.domain_res(atom())
  def execute(community_ref, thread, group_id, tags, %User{} = actor, command_id) do
    with {:ok, command_id} <- TagSupport.command_id(command_id),
         {:ok, community} <- TagSupport.community(community_ref) do
      execute_pipeline(community, thread, group_id, tags || [], actor, command_id)
    end
  end

  @pipeline operation: :tags_reindex_in_group, target: :community
  direct_pipeline execute_pipeline(community, thread, group_id, tags, actor, command_id) do
    gate(fn candidate -> Gate.check_in_transaction(actor, :update, candidate) end)

    change(fn canonical, operation_ref ->
      Mutation.reindex_in_group(canonical, thread, group_id, tags, operation_ref: operation_ref)
    end)
  end
end
