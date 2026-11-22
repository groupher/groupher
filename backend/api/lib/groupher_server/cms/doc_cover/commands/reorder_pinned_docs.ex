defmodule GroupherServer.CMS.DocCover.Commands.ReorderPinnedDocs do
  @moduledoc """
  Reorders the complete pinned-doc collection under Gate admission.

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
  Executes the pinned-doc order command.

  ## Examples

      ReorderPinnedDocs.execute(community, node_ids, actor, command_id)
      #=> {:ok, %{done: true}}
  """
  @spec execute(Community.t(), list(), term(), Ecto.UUID.t()) :: term()
  @pipeline operation: :doc_cover_reorder_pinned_docs,
            confirmation: DocCoverConfirmation,
            target: :community,
            params: [:ids]

  receipt_pipeline execute(community, ids, actor, command_id) do
    gate(fn candidate -> CMS.Gate.check_in_transaction(actor, :manage_docs, candidate) end)

    change(fn canonical, operation_ref ->
      CMS.DocTree.Publication.Presentation.write(canonical, operation_ref, fn ->
        Persist.reorder_pinned_docs(canonical, ids)
      end)
    end)

    confirm(fn result -> {:ok, ConfirmationSupport.confirmation(result, command_id)} end)
    present(fn confirmation -> ConfirmationSupport.present({:ok, confirmation}) end)
  end
end
