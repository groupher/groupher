defmodule GroupherServer.CMS.Articles.Commands.SaveWorkingCopyConfirmation do
  @moduledoc """
  Stores the saved WorkingCopy ID and new revision for command replay.

      successful save -> WorkingCopy ID + revision -> Receipt replay result
  """
  use GroupherServer.CMS.Command.ConfirmationDefinition,
    operation: :article_save_working_copy,
    data_keys: ["working_copy_id", "revision", "command_id"],
    field_types: %{
      "working_copy_id" => :string,
      "revision" => :integer,
      "command_id" => :string
    }
end
