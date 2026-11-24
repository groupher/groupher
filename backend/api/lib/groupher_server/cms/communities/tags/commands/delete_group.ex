defmodule GroupherServer.CMS.Communities.Tags.Commands.DeleteTagGroup do
  @moduledoc """
  Deletes a community tag group through a `receipt_pipeline`.

      GraphQL -> Communities facade -> DeleteTagGroup -> Command + Gate -> Tags + Outbox
  """

  use GroupherServer.CommandPipeline,
    adapter: GroupherServer.CMS.CommandPipelineAdapter

  alias GroupherServer.{Accounts, CMS}

  alias CMS.{Gate, FrontDesk}
  alias CMS.Communities.Tags.Commands.{TagGroupConfirmation, TagSupport}
  alias CMS.Communities.Tags.Mutation
  alias CMS.Model.{Community, CommunityTagGroup}
  alias Accounts.Model.User
  alias Helper.T

  @doc "Deletes a tag group from a Community thread through the command pipeline."
  @spec execute(Community.t(), atom(), T.id(), User.t(), Ecto.UUID.t()) ::
          T.domain_res(CommunityTagGroup.t())
  def execute(community, thread, id, %User{} = actor, command_id) do
    target =
      case FrontDesk.community_tag_group(id) do
        {:ok, %CommunityTagGroup{} = group} -> group
        {:error, _reason} -> {:community_tag_group, id}
      end

    execute_pipeline(target, community, community.id, thread, actor, command_id)
  end

  @pipeline operation: :tag_group_delete,
            confirmation: TagGroupConfirmation,
            target: :group,
            params: [:community_id, :thread]

  receipt_pipeline execute_pipeline(group, community, community_id, thread, actor, command_id) do
    gate(fn
      %CommunityTagGroup{} = candidate ->
        with {:ok, canonical} <-
               Gate.check_in_transaction(actor, :community_tag_delete, community) do
          {:ok, {canonical, candidate}}
        end

      {:community_tag_group, _id} ->
        {:error, CMS.Communities.ErrorCat.not_exist("CommunityTagGroup")}
    end)

    change(fn {canonical, candidate}, operation_ref ->
      Mutation.delete_group(canonical, thread, candidate.id, operation_ref: operation_ref)
    end)

    confirm(fn deleted ->
      {:ok, TagSupport.confirmation(TagGroupConfirmation, "group_id", deleted.id, command_id)}
    end)

    present(fn confirmation -> TagSupport.group_confirmation(confirmation) end)
  end
end
