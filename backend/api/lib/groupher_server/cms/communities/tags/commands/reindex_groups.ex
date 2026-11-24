defmodule GroupherServer.CMS.Communities.Tags.Commands.ReindexTagGroups do
  @moduledoc """
  Reindexes tag groups through a Gate-admitted `direct_pipeline`.

      GraphQL -> ReindexTagGroups -> Gate -> Tags batch update + taxonomy Outbox
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

  @doc "Reorders Community tag groups through the retry-safe command pipeline."
  @spec execute(Community.t() | String.t(), atom(), list(), User.t(), Ecto.UUID.t()) ::
          T.domain_res(atom())
  def execute(community_ref, thread, groups, %User{} = actor, command_id) do
    with {:ok, command_id} <- TagSupport.command_id(command_id),
         {:ok, community} <- TagSupport.community(community_ref) do
      execute_pipeline(community, thread, groups, actor, command_id)
    end
  end

  @pipeline operation: :tag_groups_reindex, target: :community
  direct_pipeline execute_pipeline(community, thread, groups, actor, command_id) do
    gate(fn candidate -> Gate.check_in_transaction(actor, :community_tag_reindex, candidate) end)

    change(fn canonical, operation_ref ->
      Mutation.reindex_groups(canonical, thread, groups, operation_ref: operation_ref)
    end)
  end
end
