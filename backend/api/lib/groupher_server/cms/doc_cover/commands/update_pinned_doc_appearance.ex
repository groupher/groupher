defmodule GroupherServer.CMS.DocCover.Commands.UpdatePinnedDocAppearance do
  @moduledoc """
  Updates one pinned Doc appearance under Gate admission.

      GraphQL mutation
        -> concrete DocCover command
        -> CMS.Gate
        -> DocCover.Persist
  """
  use GroupherServer.CommandPipeline,
    adapter: GroupherServer.CMS.CommandPipelineAdapter

  alias GroupherServer.CMS
  alias CMS.DocCover.Persist
  alias CMS.Model.Community

  @doc """
  Executes the pinned appearance command.

  ## Examples

      UpdatePinnedDocAppearance.execute(community, node_id, appearance, actor, command_id)
      #=> {:ok, pinned_doc}
  """
  @spec execute(Community.t(), term(), map(), term(), Ecto.UUID.t()) :: term()
  @pipeline operation: :doc_cover_update_pinned_doc_appearance, target: :community
  direct_pipeline execute(community, node_id, appearance, actor, command_id) do
    gate(fn candidate -> CMS.Gate.check_in_transaction(actor, :manage_docs, candidate) end)

    change(fn canonical ->
      CMS.DocTree.Publication.Presentation.write(canonical, fn ->
        Persist.update_pinned_doc_appearance(canonical, node_id, appearance)
      end)
    end)
  end
end
