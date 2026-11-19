defmodule GroupherServer.CMS.Communities.Tags.Commands.UpdateTagGroup do
  @moduledoc """
  Updates a community tag group through a `receipt_pipeline`.

      GraphQL -> Communities facade -> UpdateTagGroup -> Command + Gate -> Tags + Outbox
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

  @spec execute(Community.t(), atom(), T.id(), map(), User.t(), Ecto.UUID.t()) ::
          T.domain_res(CommunityTagGroup.t())
  def execute(community, thread, id, attrs, %User{} = actor, command_id) do
    target =
      case FrontDesk.community_tag_group(id) do
        {:ok, %CommunityTagGroup{} = group} -> group
        {:error, _reason} -> {:community_tag_group, id}
      end

    execute_pipeline(
      target,
      community,
      community.id,
      thread,
      TagSupport.intent_attrs(attrs),
      actor,
      command_id
    )
  end

  @pipeline operation: :tag_group_update,
            confirmation: TagGroupConfirmation,
            target: :group,
            params: [:community_id, :thread, :attrs]

  receipt_pipeline execute_pipeline(
                     group,
                     community,
                     community_id,
                     thread,
                     attrs,
                     actor,
                     command_id
                   ) do
    gate(fn
      %CommunityTagGroup{} = candidate ->
        with {:ok, canonical} <- Gate.check_in_transaction(actor, :update, community) do
          {:ok, {canonical, candidate}}
        end

      {:community_tag_group, _id} ->
        {:error, CMS.Communities.ErrorCat.not_exist("CommunityTagGroup")}
    end)

    change(fn {canonical, candidate}, operation_ref ->
      Mutation.update_group(canonical, thread, candidate.id, attrs, operation_ref: operation_ref)
    end)

    confirm(fn updated ->
      {:ok, TagSupport.confirmation(TagGroupConfirmation, "group_id", updated.id, command_id)}
    end)

    present(fn confirmation -> TagSupport.group_confirmation(confirmation) end)
  end
end
