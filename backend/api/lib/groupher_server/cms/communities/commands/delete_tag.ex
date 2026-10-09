defmodule GroupherServer.CMS.Communities.Commands.DeleteTag do
  @moduledoc """
  Deletes a community tag through the receipt-backed command boundary.

      GraphQL -> Communities facade -> DeleteTag -> Command + Gate -> Tags + Outbox
  """

  alias GroupherServer.CMS
  alias CMS.{Command, Gate, FrontDesk}
  alias CMS.Communities.Commands.{TagConfirmation, TagSupport}
  alias CMS.Communities.Tags
  alias CMS.Model.CommunityTag
  alias GroupherServer.Accounts.Model.User
  alias Helper.T

  @spec execute(T.id(), User.t(), Ecto.UUID.t()) :: T.domain_res(CommunityTag.t())
  def execute(id, %User{} = actor, command_id) do
    target =
      case FrontDesk.community_tag(id) do
        {:ok, %CommunityTag{} = tag} -> tag
        {:error, _reason} -> {:community_tag, id}
      end

    command = %Command{
      actor: actor,
      command_id: command_id,
      operation: :tag_delete,
      target: target,
      params: %{}
    }

    with {:ok, confirmation} <-
           Command.execute(command, action: &action/1, confirmation: TagConfirmation) do
      TagSupport.tag_confirmation(confirmation)
    end
  end

  defp action(%{actor: actor, target: tag, command_id: command_id}) do
    with {:ok, community} <- TagSupport.community(tag.community_id),
         {:ok, %CommunityTag{} = deleted} <-
           Gate.with_community_check(actor, :update, community, fn _canonical ->
             Tags.delete(tag.id, command_id: command_id)
           end) do
      {:ok, TagSupport.confirmation(TagConfirmation, "tag_id", deleted.id, command_id)}
    end
  end

  defp action(%{target: {:community_tag, _id}}),
    do: {:error, GroupherServer.CMS.Communities.ErrorCat.not_exist("CommunityTag")}
end
