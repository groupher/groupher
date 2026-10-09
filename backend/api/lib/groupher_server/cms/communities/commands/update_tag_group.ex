defmodule GroupherServer.CMS.Communities.Commands.UpdateTagGroup do
  @moduledoc """
  Updates a community tag group through the receipt-backed command boundary.

      GraphQL -> Communities facade -> UpdateTagGroup -> Command + Gate -> Tags + Outbox
  """

  alias GroupherServer.CMS
  alias CMS.{Command, Gate, FrontDesk}
  alias CMS.Communities.Commands.{TagGroupConfirmation, TagSupport}
  alias CMS.Communities.Tags
  alias CMS.Model.{Community, CommunityTagGroup}
  alias GroupherServer.Accounts.Model.User
  alias Helper.T

  @spec execute(Community.t(), atom(), T.id(), map(), User.t(), Ecto.UUID.t()) ::
          T.domain_res(CommunityTagGroup.t())
  def execute(community, thread, id, attrs, %User{} = actor, command_id) do
    with {:ok, %CommunityTagGroup{} = group} <- FrontDesk.community_tag_group(id) do
      command = %Command{
        actor: actor,
        command_id: command_id,
        operation: :tag_group_update,
        target: group,
        params: %{
          community_id: community.id,
          thread: thread,
          attrs: TagSupport.intent_attrs(attrs)
        }
      }

      with {:ok, confirmation} <-
             Command.execute(command, action: &action/1, confirmation: TagGroupConfirmation) do
        TagSupport.group_confirmation(confirmation)
      end
    end
  end

  defp action(%{
         actor: actor,
         target: group,
         params: %{community_id: community_id, thread: thread, attrs: attrs},
         command_id: command_id
       }) do
    with {:ok, community} <- TagSupport.community(community_id),
         {:ok, %CommunityTagGroup{} = updated} <-
           Gate.with_community_check(actor, :update, community, fn _canonical ->
             Tags.update_group(community, thread, group.id, attrs, command_id: command_id)
           end) do
      {:ok, TagSupport.confirmation(TagGroupConfirmation, "group_id", updated.id, command_id)}
    end
  end
end
