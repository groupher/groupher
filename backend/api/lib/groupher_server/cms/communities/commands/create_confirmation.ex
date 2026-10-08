defmodule GroupherServer.CMS.Communities.Commands.CreateConfirmation do
  @moduledoc """
  Encodes the canonical Community identity returned by a create command.

      community create
        -> CMS.Command receipt
        -> CreateConfirmation(community_id, command_id)
        -> Community reload on recovery
  """

  use GroupherServer.CMS.Command.ConfirmationDefinition,
    operation: :community_create,
    data_keys: ["community_id", "command_id"],
    field_types: %{
      "community_id" => :integer,
      "command_id" => :string
    }
end
