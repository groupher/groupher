defmodule GroupherServer.CMS.Communities.Tags.Commands.CreateTagGroup do
  @moduledoc """
  Creates a community tag group through the receipt-backed command boundary.

      GraphQL -> Communities facade -> CreateTagGroup -> Command + Gate -> Tags + Outbox
  """

  alias GroupherServer.CMS
  alias CMS.{Command, Gate}
  alias CMS.Communities.Tags.Commands.{TagGroupConfirmation, TagSupport}
  alias CMS.Communities.Tags.Mutation
  alias CMS.Model.{Community, CommunityTagGroup}
  alias GroupherServer.Accounts.Model.User
  alias Helper.T

  @spec execute(Community.t(), atom(), map(), User.t(), Ecto.UUID.t()) ::
          T.domain_res(CommunityTagGroup.t())
  def execute(%Community{} = community, thread, attrs, %User{} = actor, command_id) do
    command = %Command{
      actor: actor,
      command_id: command_id,
      operation: :tag_group_create,
      target: community,
      params: %{thread: thread, attrs: TagSupport.intent_attrs(attrs)}
    }

    with {:ok, confirmation} <-
           Command.execute(command, action: &action/1, confirmation: TagGroupConfirmation) do
      TagSupport.group_confirmation(confirmation)
    end
  end

  defp action(%{
         actor: actor,
         target: community,
         params: %{thread: thread, attrs: attrs},
         command_id: command_id
       }) do
    Gate.with_community_check(actor, :update, community, fn canonical ->
      with {:ok, %CommunityTagGroup{} = group} <-
             Mutation.create_group(canonical, thread, attrs, command_id: command_id) do
        {:ok, TagSupport.confirmation(TagGroupConfirmation, "group_id", group.id, command_id)}
      end
    end)
  end
end
