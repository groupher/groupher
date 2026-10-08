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
  def execute(community, ids, actor, _command_id),
    do: Support.run(actor, :manage_docs, community, &Persist.reorder_cards(&1, ids))
end
