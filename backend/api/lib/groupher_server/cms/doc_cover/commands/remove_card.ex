defmodule GroupherServer.CMS.DocCover.Commands.RemoveCard do
  @moduledoc """
  Removes one docs cover card under Gate admission.

      GraphQL mutation
        -> concrete DocCover command
        -> CMS.Gate
        -> DocCover.Persist
  """
  alias GroupherServer.CMS
  alias CMS.DocCover.Commands.Support
  alias CMS.DocCover.Persist
  alias CMS.Model.Community

  @doc """
  Executes the remove-card command.

  ## Examples

      RemoveCard.execute(community, group_node_id, actor, command_id)
      #=> {:ok, cover_card}
  """
  @spec execute(Community.t(), term(), term(), Ecto.UUID.t()) :: term()
  def execute(community, group_node_id, actor, command_id),
    do:
      Support.execute_receipted(
        community,
        actor,
        command_id,
        :doc_cover_remove_card,
        %{group_node_id: group_node_id},
        &Persist.remove_card(&1, group_node_id)
      )
end
