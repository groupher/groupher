defmodule GroupherServer.CMS.Communities.Tags.Commands.CreateTag do
  @moduledoc """
  Creates a community tag through the receipt-backed command boundary.

      GraphQL -> Communities facade -> CreateTag -> Command + Gate -> Tags + Outbox
  """

  alias GroupherServer.CMS
  alias CMS.{Command, Gate}
  alias CMS.Communities.Tags.Commands.{TagConfirmation, TagSupport}
  alias CMS.Communities.Tags.Mutation
  alias CMS.Model.{Community, CommunityTag}
  alias GroupherServer.Accounts.Model.User
  alias Helper.T

  @spec execute(Community.t(), atom(), map(), User.t(), Ecto.UUID.t()) ::
          T.domain_res(CommunityTag.t())
  def execute(%Community{} = community, thread, attrs, %User{} = actor, command_id) do
    command = %Command{
      actor: actor,
      command_id: command_id,
      operation: :tag_create,
      target: community,
      params: %{thread: thread, attrs: TagSupport.intent_attrs(attrs)}
    }

    with {:ok, confirmation} <-
           Command.execute(command, action: &action/1, confirmation: TagConfirmation) do
      TagSupport.tag_confirmation(confirmation)
    end
  end

  defp action(%{
         actor: actor,
         target: community,
         params: %{thread: thread, attrs: attrs},
         command_id: command_id
       }) do
    Gate.with_community_check(actor, :update, community, fn canonical ->
      with {:ok, %CommunityTag{} = tag} <-
             Mutation.create(canonical, thread, attrs, actor, command_id: command_id) do
        {:ok, TagSupport.confirmation(TagConfirmation, "tag_id", tag.id, command_id)}
      end
    end)
  end
end
