defmodule GroupherServer.CMS.Communities.Tags.Commands.UpdateTag do
  @moduledoc """
  Updates a community tag through the receipt-backed command boundary.

      GraphQL -> Communities facade -> UpdateTag -> Command + Gate -> Tags + Outbox
  """

  alias GroupherServer.CMS
  alias CMS.{Command, Gate, FrontDesk}
  alias CMS.Communities.Tags.Commands.{TagConfirmation, TagSupport}
  alias CMS.Communities.Tags.Mutation
  alias CMS.Model.CommunityTag
  alias GroupherServer.Accounts.Model.User
  alias Helper.T

  @spec execute(T.id(), map(), User.t(), Ecto.UUID.t()) :: T.domain_res(CommunityTag.t())
  def execute(id, attrs, %User{} = actor, command_id) do
    target =
      case FrontDesk.community_tag(id) do
        {:ok, %CommunityTag{} = tag} -> tag
        {:error, _reason} -> {:community_tag, id}
      end

    command = %Command{
      actor: actor,
      command_id: command_id,
      operation: :tag_update,
      target: target,
      params: TagSupport.intent_attrs(attrs)
    }

    with {:ok, confirmation} <-
           Command.execute(command, action: &action/1, confirmation: TagConfirmation) do
      TagSupport.tag_confirmation(confirmation)
    end
  end

  defp action(%{target: {:community_tag, _id}}),
    do: {:error, CMS.Communities.ErrorCat.not_exist("CommunityTag")}

  defp action(%{actor: actor, target: tag, params: attrs, command_id: command_id}) do
    with {:ok, community} <- TagSupport.community(tag.community_id),
         {:ok, %CommunityTag{} = updated} <-
           Gate.with_community_check(actor, :update, community, fn _canonical ->
             Mutation.update(tag.id, attrs, command_id: command_id)
           end) do
      {:ok, TagSupport.confirmation(TagConfirmation, "tag_id", updated.id, command_id)}
    end
  end
end
