defmodule GroupherServer.CMS.DocTree.Commands.RestoreWorkspaceNodeConfirmation do
  @moduledoc """
  Stores the restored root and site revisions for a restore Receipt.

      Docs command -> Confirmation -> Command Receipt -> replay result
  """
  use GroupherServer.CMS.Command.ConfirmationDefinition,
    operation: :docs_restore_workspace_node,
    data_keys: ["community_id", "node_id", "tree_revision", "queue_revision"],
    field_types: %{
      "community_id" => :integer,
      "node_id" => :string,
      "tree_revision" => :integer,
      "queue_revision" => :integer
    }
end
