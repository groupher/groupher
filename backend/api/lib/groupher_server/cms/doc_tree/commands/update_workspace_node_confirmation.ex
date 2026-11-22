defmodule GroupherServer.CMS.DocTree.Commands.UpdateWorkspaceNodeConfirmation do
  @moduledoc """
  Stores the committed workspace revision for a node update.

      Docs command -> Confirmation -> Command Receipt -> replay result
  """
  use GroupherServer.CMS.Command.ConfirmationDefinition,
    operation: :docs_update_workspace_node,
    operations: [:docs_update_workspace_node, :docs_move_workspace_node],
    data_keys: ["community_id", "tree_revision"],
    field_types: %{"community_id" => :integer, "tree_revision" => :integer}
end
