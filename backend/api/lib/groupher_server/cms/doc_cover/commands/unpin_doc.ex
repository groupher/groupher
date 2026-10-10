defmodule GroupherServer.CMS.DocCover.Commands.UnpinDoc do
  @moduledoc """
  Removes one pinned Doc page under Gate admission.

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
  Executes the unpin command.

  ## Examples

      UnpinDoc.execute(community, node_id, actor, command_id)
      #=> {:ok, pinned_doc}
  """
  @spec execute(Community.t(), term(), term(), Ecto.UUID.t()) :: term()
  def execute(community, node_id, actor, command_id),
    do:
      Support.execute_receipted(
        community,
        actor,
        command_id,
        :doc_cover_unpin_doc,
        %{node_id: node_id},
        &Persist.unpin_doc(&1, node_id)
      )
end
