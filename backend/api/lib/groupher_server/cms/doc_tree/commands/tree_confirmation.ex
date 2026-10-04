defmodule GroupherServer.CMS.DocTree.Commands.TreeConfirmation do
  @moduledoc """
  Confirms DocTree mutations that return the shared strict tree result payload.

      DocTree node mutation / trash restore
        -> TreeConfirmation
        -> CommandReplay.replay_confirmation/1
  """

  use GroupherServer.CMS.Command.ConfirmationDefinition,
    operation: :doc_tree_create_tab,
    operations: [
      :doc_tree_create_tab,
      :doc_tree_create_group,
      :doc_tree_create_page,
      :doc_tree_create_link,
      :doc_tree_create_pin,
      :doc_tree_update_node,
      :doc_tree_delete_node,
      :doc_tree_duplicate_node,
      :doc_tree_move_node,
      :doc_tree_restore_trash_item
    ],
    data_keys: ["result_key", "result_payload"],
    field_types: %{
      "result_key" => :string,
      "result_payload" => {:doc_tree_result, :tree}
    }
end
