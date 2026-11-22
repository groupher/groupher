defmodule GroupherServer.CMS.DocCover.Commands.UpdateCardAppearance do
  @moduledoc """
  Updates one docs cover card appearance under Gate admission.

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
  Executes the card appearance command.

  ## Examples

      UpdateCardAppearance.execute(community, card_id, appearance, actor, command_id)
      #=> {:ok, cover_card}
  """
  @spec execute(Community.t(), term(), map(), term(), Ecto.UUID.t()) :: term()
  @pipeline operation: :doc_cover_update_card_appearance, target: :community
  direct_pipeline execute(community, card_id, appearance, actor, command_id) do
    gate(fn candidate -> CMS.Gate.check_in_transaction(actor, :manage_docs, candidate) end)

    change(fn canonical, operation_ref ->
      CMS.DocTree.Publication.Presentation.write(canonical, operation_ref, fn ->
        Persist.update_card_appearance(canonical, card_id, appearance)
      end)
    end)
  end
end
