defmodule GroupherServer.CMS.Communities.Tags.Commands.TagConfirmation do
  @moduledoc """
  Defines the tag CRUD Confirmation codec.

      Tag Command -> TagConfirmation -> Receipt storage / result recovery
  """

  use GroupherServer.CMS.Command.ConfirmationDefinition,
    operation: :tag_create,
    operations: [:tag_create, :tag_update, :tag_delete],
    data_keys: ["tag_id", "command_id"],
    field_types: %{"tag_id" => :integer, "command_id" => :string}
end
