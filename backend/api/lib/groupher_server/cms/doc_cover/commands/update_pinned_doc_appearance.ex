defmodule GroupherServer.CMS.DocCover.Commands.UpdatePinnedDocAppearance do
  @moduledoc """
  Updates one pinned Doc appearance under Gate admission.

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
  Executes the pinned appearance command.

  ## Examples

      UpdatePinnedDocAppearance.execute(community, node_id, appearance, actor, command_id)
      #=> {:ok, pinned_doc}
  """
  @spec execute(Community.t(), term(), map(), term(), Ecto.UUID.t()) :: term()
  def execute(community, node_id, appearance, actor, _command_id),
    do:
      Support.run(
        actor,
        :manage_docs,
        community,
        &Persist.update_pinned_doc_appearance(&1, node_id, appearance)
      )
end
