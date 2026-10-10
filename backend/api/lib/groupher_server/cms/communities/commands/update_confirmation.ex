defmodule GroupherServer.CMS.Communities.Commands.UpdateConfirmation do
  @moduledoc "Receipt codec for Community field updates."

  use GroupherServer.CMS.Command.ConfirmationDefinition,
    operation: :community_update,
    data_keys: ["community_id", "command_id"],
    field_types: %{"community_id" => :integer, "command_id" => :string}
end
