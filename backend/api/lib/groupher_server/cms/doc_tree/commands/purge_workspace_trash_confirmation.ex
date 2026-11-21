defmodule GroupherServer.CMS.DocTree.Commands.PurgeWorkspaceTrashConfirmation do
  @moduledoc """
  Records successful permanent removal of a Docs Trash action.

      Docs command -> Confirmation -> Command Receipt -> replay result
  """
  use GroupherServer.CMS.Command.ConfirmationDefinition,
    operation: :docs_purge_workspace_trash,
    data_keys: ["community_id", "trash_action_id"],
    field_types: %{"community_id" => :integer, "trash_action_id" => :string}
end
