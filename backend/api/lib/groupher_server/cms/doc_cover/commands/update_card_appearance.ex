defmodule GroupherServer.CMS.DocCover.Commands.UpdateCardAppearance do
  @moduledoc """
  Updates one docs cover card appearance under Gate admission.

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
  Executes the card appearance command.

  ## Examples

      UpdateCardAppearance.execute(community, card_id, appearance, actor, command_id)
      #=> {:ok, cover_card}
  """
  @spec execute(Community.t(), term(), map(), term(), Ecto.UUID.t()) :: term()
  def execute(community, card_id, appearance, actor, _command_id),
    do:
      Support.run(
        actor,
        :manage_docs,
        community,
        &Persist.update_card_appearance(&1, card_id, appearance)
      )
end
