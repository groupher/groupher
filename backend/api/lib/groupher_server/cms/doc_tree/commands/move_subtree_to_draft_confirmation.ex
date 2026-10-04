defmodule GroupherServer.CMS.DocTree.Commands.MoveSubtreeToDraftConfirmation do
  @moduledoc """
  Confirms moving a DocTree subtree back to draft.

      doc_move_subtree_to_draft -> encode -> Receipt -> decode on retry
  """

  use GroupherServer.CMS.Command.ConfirmationDefinition,
    operation: :doc_move_subtree_to_draft,
    data_keys: ["result_payload"],
    field_types: %{"result_payload" => {:doc_tree_result, :subtree}}
end
