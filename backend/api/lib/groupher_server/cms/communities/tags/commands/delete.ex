defmodule GroupherServer.CMS.Communities.Tags.Commands.Delete do
  @moduledoc """
  Deletes a community tag through a `receipt_pipeline`.

      GraphQL -> Communities facade -> Delete -> Command + Gate -> Tags + Outbox
  """

  use GroupherServer.CommandPipeline,
    adapter: GroupherServer.CMS.CommandPipelineAdapter

  alias GroupherServer.{Accounts, CMS}

  alias CMS.{Gate, FrontDesk}
  alias CMS.Communities.Tags.Commands.{TagConfirmation, TagSupport}
  alias CMS.Communities.Tags.Mutation
  alias CMS.Model.CommunityTag
  alias Accounts.Model.User
  alias Helper.T

  @spec execute(T.id(), User.t(), Ecto.UUID.t()) :: T.domain_res(CommunityTag.t())
  def execute(id, %User{} = actor, command_id) do
    target =
      case FrontDesk.community_tag(id) do
        {:ok, %CommunityTag{} = tag} -> tag
        {:error, _reason} -> {:community_tag, id}
      end

    execute_pipeline(target, actor, command_id)
  end

  @pipeline operation: :tag_delete,
            confirmation: TagConfirmation,
            target: :tag,
            params: []

  receipt_pipeline execute_pipeline(tag, actor, command_id) do
    gate(fn
      %CommunityTag{} = candidate ->
        with {:ok, community} <- TagSupport.community(candidate.community_id),
             {:ok, _canonical} <- Gate.check_in_transaction(actor, :update, community) do
          {:ok, candidate}
        end

      {:community_tag, _id} ->
        {:error, CMS.Communities.ErrorCat.not_exist("CommunityTag")}
    end)

    change(fn candidate, operation_ref ->
      Mutation.delete(candidate.id, operation_ref: operation_ref)
    end)

    confirm(fn deleted ->
      {:ok, TagSupport.confirmation(TagConfirmation, "tag_id", deleted.id, command_id)}
    end)

    present(fn confirmation -> TagSupport.tag_confirmation(confirmation) end)
  end
end
