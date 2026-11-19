defmodule GroupherServer.CMS.DocCover.Commands.PinDoc do
  @moduledoc """
  Pins one published Doc page under Gate admission.

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
  Executes the pin command.

  ## Examples

      PinDoc.execute(community, node_id, actor, command_id)
      #=> {:ok, pinned_doc}
  """
  @spec execute(Community.t(), term(), term(), Ecto.UUID.t()) :: term()
  @pipeline operation: :doc_cover_pin_doc,
            confirmation: DocCoverConfirmation,
            target: :community,
            params: [:node_id]
  receipt_pipeline execute(community, node_id, actor, command_id) do
    gate(fn candidate -> CMS.Gate.check_in_transaction(actor, :manage_docs, candidate) end)

    change(fn canonical, operation_ref ->
      CMS.DocTree.Publication.Presentation.write(canonical, operation_ref, fn ->
        Persist.pin_doc(canonical, node_id)
      end)
    end)

    confirm(fn result -> {:ok, ConfirmationSupport.confirmation(result, command_id)} end)
    present(fn confirmation -> ConfirmationSupport.present({:ok, confirmation}) end)
  end
end
