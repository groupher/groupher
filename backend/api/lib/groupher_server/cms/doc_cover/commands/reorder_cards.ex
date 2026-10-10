defmodule GroupherServer.CMS.DocCover.Commands.ReorderCards do
  @moduledoc """
  Reorders docs cover cards under Gate admission.

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
  Executes the card-order command.

  ## Examples

      ReorderCards.execute(community, ids, actor, command_id)
      #=> {:ok, %{done: true}}
  """
  @spec execute(Community.t(), list(), term(), Ecto.UUID.t()) :: term()
  def execute(community, ids, actor, command_id) do
    Support.execute_receipted(
      community,
      actor,
      command_id,
      :doc_cover_reorder_cards,
      %{ids: ids},
      &Persist.reorder_cards(&1, ids)
    )
  end
end
