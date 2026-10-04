defmodule GroupherServer.CMS.DocTree.Commands.MoveDocToDraftConfirmation do
  @moduledoc """
  Confirms moving one DocTree document back to draft.

      doc_move_to_draft -> encode -> Receipt -> decode on retry
  """

  use GroupherServer.CMS.Command.ConfirmationDefinition,
    operation: :doc_move_to_draft,
    data_keys: ["article_id"],
    field_types: %{"article_id" => :string}
end
