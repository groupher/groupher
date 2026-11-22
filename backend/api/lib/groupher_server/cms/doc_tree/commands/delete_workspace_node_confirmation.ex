defmodule GroupherServer.CMS.DocTree.Commands.DeleteWorkspaceNodeConfirmation do
  @moduledoc """
  Stores the committed Trash identity and site revisions for a delete Receipt.

      Docs command -> Confirmation -> Command Receipt -> replay result
  """
  use GroupherServer.CMS.Command.ConfirmationDefinition,
    operation: :docs_delete_workspace_node,
    data_keys: ["community_id", "trash_action_id", "tree_revision", "queue_revision"],
    field_types: %{
      "community_id" => :integer,
      "trash_action_id" => :string,
      "tree_revision" => :integer,
      "queue_revision" => :integer
    }
end
