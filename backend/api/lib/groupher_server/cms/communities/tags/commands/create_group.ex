defmodule GroupherServer.CMS.Communities.Tags.Commands.CreateTagGroup do
  @moduledoc """
  Creates a community tag group through a `receipt_pipeline`.

      GraphQL -> Communities facade -> CreateTagGroup -> Command + Gate -> Tags + Outbox
  """

  use GroupherServer.CommandPipeline,
    adapter: GroupherServer.CMS.CommandPipelineAdapter

  alias GroupherServer.{Accounts, CMS}

  alias CMS.Gate
  alias CMS.Communities.Tags.Commands.{TagGroupConfirmation, TagSupport}
  alias CMS.Communities.Tags.Mutation
  alias CMS.Model.{Community, CommunityTagGroup}
  alias Accounts.Model.User
  alias Helper.T

  @spec execute(Community.t(), atom(), map(), User.t(), Ecto.UUID.t()) ::
          T.domain_res(CommunityTagGroup.t())
  def execute(%Community{} = community, thread, attrs, %User{} = actor, command_id) do
    execute_pipeline(community, thread, TagSupport.intent_attrs(attrs), actor, command_id)
  end

  @pipeline operation: :tag_group_create,
            confirmation: TagGroupConfirmation,
            target: :community,
            params: [:thread, :attrs]

  receipt_pipeline execute_pipeline(community, thread, attrs, actor, command_id) do
    gate(fn candidate -> Gate.check_in_transaction(actor, :community_tag_create, candidate) end)

    change(fn canonical, operation_ref ->
      Mutation.create_group(canonical, thread, attrs, operation_ref: operation_ref)
    end)

    confirm(fn group ->
      {:ok, TagSupport.confirmation(TagGroupConfirmation, "group_id", group.id, command_id)}
    end)

    present(fn confirmation -> TagSupport.group_confirmation(confirmation) end)
  end
end
