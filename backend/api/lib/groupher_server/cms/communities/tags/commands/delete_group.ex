defmodule GroupherServer.CMS.Communities.Tags.Commands.DeleteTagGroup do
  @moduledoc """
  Deletes a community tag group through the receipt-backed command boundary.

      GraphQL -> Communities facade -> DeleteTagGroup -> Command + Gate -> Tags + Outbox
  """

  alias GroupherServer.CMS
  alias CMS.{Command, Gate, FrontDesk}
  alias CMS.Communities.Tags.Commands.{TagGroupConfirmation, TagSupport}
  alias CMS.Communities.Tags.Mutation
  alias CMS.Model.{Community, CommunityTagGroup}
  alias GroupherServer.Accounts.Model.User
  alias Helper.T

  @spec execute(Community.t(), atom(), T.id(), User.t(), Ecto.UUID.t()) ::
          T.domain_res(CommunityTagGroup.t())
  def execute(community, thread, id, %User{} = actor, command_id) do
    target =
      case FrontDesk.community_tag_group(id) do
        {:ok, %CommunityTagGroup{} = group} -> group
        {:error, _reason} -> {:community_tag_group, id}
      end

    command = %Command{
      actor: actor,
      command_id: command_id,
      operation: :tag_group_delete,
      target: target,
      params: %{community_id: community.id, thread: thread}
    }

    with {:ok, confirmation} <-
           Command.execute(command, action: &action/1, confirmation: TagGroupConfirmation) do
      TagSupport.group_confirmation(confirmation)
    end
  end

  defp action(%{
         actor: actor,
         target: group,
         params: %{community_id: community_id, thread: thread},
         command_id: command_id
       }) do
    with {:ok, community} <- TagSupport.community(community_id),
         {:ok, %CommunityTagGroup{} = deleted} <-
           Gate.with_community_check(actor, :update, community, fn _canonical ->
             Mutation.delete_group(community, thread, group.id, command_id: command_id)
           end) do
      {:ok, TagSupport.confirmation(TagGroupConfirmation, "group_id", deleted.id, command_id)}
    end
  end

  defp action(%{target: {:community_tag_group, _id}}),
    do: {:error, GroupherServer.CMS.Communities.ErrorCat.not_exist("CommunityTagGroup")}
end
