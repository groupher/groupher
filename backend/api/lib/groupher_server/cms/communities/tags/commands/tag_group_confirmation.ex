defmodule GroupherServer.CMS.Communities.Tags.Commands.TagGroupConfirmation do
  @moduledoc """
  Defines the tag-group CRUD Confirmation codec.

      TagGroup Command -> TagGroupConfirmation -> Receipt storage / result recovery
  """

  use GroupherServer.CMS.Command.ConfirmationDefinition,
    operation: :tag_group_create,
    operations: [:tag_group_create, :tag_group_update, :tag_group_delete],
    data_keys: ["group_id", "command_id"],
    field_types: %{"group_id" => :integer, "command_id" => :string}
end
