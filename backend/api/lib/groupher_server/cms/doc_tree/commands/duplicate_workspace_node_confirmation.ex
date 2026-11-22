defmodule GroupherServer.CMS.DocTree.Commands.DuplicateWorkspaceNodeConfirmation do
  @moduledoc """
  Stores the identity and revision produced by workspace node duplication.

      Docs command -> Confirmation -> Command Receipt -> replay result
  """

  use GroupherServer.CMS.Command.ConfirmationDefinition,
    operation: :docs_duplicate_workspace_node,
    data_keys: ["community_id", "node_id", "article_id", "working_copy_id", "tree_revision"],
    field_types: %{
      "community_id" => :integer,
      "node_id" => :string,
      "article_id" => {:nullable, :string},
      "working_copy_id" => {:nullable, :string},
      "tree_revision" => :integer
    }
end
