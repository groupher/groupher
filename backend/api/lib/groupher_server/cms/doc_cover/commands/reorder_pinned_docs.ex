defmodule GroupherServer.CMS.DocCover.Commands.ReorderPinnedDocs do
  @moduledoc """
  Reorders the complete pinned-doc collection under Gate admission.

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
  Executes the pinned-doc order command.

  ## Examples

      ReorderPinnedDocs.execute(community, node_ids, actor, command_id)
      #=> {:ok, %{done: true}}
  """
  @spec execute(Community.t(), list(), term(), Ecto.UUID.t()) :: term()
  def execute(community, ids, actor, _command_id),
    do: Support.run(actor, :manage_docs, community, &Persist.reorder_pinned_docs(&1, ids))
end
