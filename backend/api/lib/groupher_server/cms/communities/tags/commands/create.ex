defmodule GroupherServer.CMS.Communities.Tags.Commands.Create do
  @moduledoc """
  Creates a community tag through a `receipt_pipeline`.

      GraphQL -> Communities facade -> Create -> Command + Gate -> Tags + Outbox
  """

  use GroupherServer.CommandPipeline,
    adapter: GroupherServer.CMS.CommandPipelineAdapter

  alias GroupherServer.{Accounts, CMS}

  alias CMS.Gate
  alias CMS.Communities.Tags.Commands.{TagConfirmation, TagSupport}
  alias CMS.Communities.Tags.Mutation
  alias CMS.Model.{Community, CommunityTag}
  alias Accounts.Model.User
  alias Helper.T

  @doc "Creates a tag in a Community thread through the retry-safe command pipeline."
  @spec execute(Community.t(), atom(), map(), User.t(), Ecto.UUID.t()) ::
          T.domain_res(CommunityTag.t())
  def execute(%Community{} = community, thread, attrs, %User{} = actor, command_id) do
    execute_pipeline(community, thread, TagSupport.intent_attrs(attrs), actor, command_id)
  end

  @pipeline operation: :tag_create,
            confirmation: TagConfirmation,
            target: :community,
            params: [:thread, :attrs]

  receipt_pipeline execute_pipeline(community, thread, attrs, actor, command_id) do
    gate(fn candidate -> Gate.check_in_transaction(actor, :community_tag_create, candidate) end)

    change(fn canonical, operation_ref ->
      Mutation.create(canonical, thread, attrs, actor, operation_ref: operation_ref)
    end)

    confirm(fn tag ->
      {:ok, TagSupport.confirmation(TagConfirmation, "tag_id", tag.id, command_id)}
    end)

    present(fn confirmation -> TagSupport.tag_confirmation(confirmation) end)
  end
end
