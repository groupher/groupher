defmodule GroupherServer.CMS.DocCover.Commands.AddCard do
  @moduledoc """
  Adds one published Group to the docs cover under Gate admission.

      GraphQL mutation
        -> concrete DocCover command
        -> CMS.Gate
        -> DocCover.Persist
  """
  use GroupherServer.CommandPipeline,
    adapter: GroupherServer.CMS.CommandPipelineAdapter

  alias GroupherServer.CMS
  alias CMS.DocCover.{Commands.ConfirmationSupport, Commands.DocCoverConfirmation, Persist}
  alias CMS.Model.Community

  @doc """
  Executes the add-card command; `command_id` is the caller's identity.

  ## Examples

      AddCard.execute(community, group_node_id, actor, command_id)
      #=> {:ok, cover_card}
  """
  @spec execute(Community.t(), term(), term(), Ecto.UUID.t()) :: term()
  @pipeline operation: :doc_cover_add_card,
            confirmation: DocCoverConfirmation,
            target: :community,
            params: [:group_node_id]
  receipt_pipeline execute(community, group_node_id, actor, command_id) do
    gate(fn candidate -> CMS.Gate.check_in_transaction(actor, :manage_docs, candidate) end)

    change(fn canonical ->
      CMS.DocTree.Publication.Presentation.write(canonical, fn ->
        Persist.add_card(canonical, group_node_id)
      end)
    end)

    confirm(fn result -> {:ok, ConfirmationSupport.confirmation(result, command_id)} end)
    present(fn confirmation -> ConfirmationSupport.present({:ok, confirmation}) end)
  end
end
