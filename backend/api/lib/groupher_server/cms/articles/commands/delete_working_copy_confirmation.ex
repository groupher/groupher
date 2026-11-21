defmodule GroupherServer.CMS.Articles.Commands.DeleteWorkingCopyConfirmation do
  @moduledoc """
  Stores the Article ID, deleted WorkingCopy ID, and command ID so an identical
  command can replay its confirmation.

      deleteWorkingCopy transaction -> confirmation IDs -> Receipt replay result
  """
  use GroupherServer.CMS.Command.ConfirmationDefinition,
    operation: :article_delete_working_copy,
    data_keys: ["article_id", "working_copy_id", "command_id"],
    field_types: %{
      "article_id" => :string,
      "working_copy_id" => :string,
      "command_id" => :string
    }
end
