defmodule GroupherServer.CMS.Communities.Categories.Confirmation do
  @moduledoc """
  Encodes Category CRUD results for Receipt recovery.

      Category command -> Confirmation -> Receipt -> Category reload
  """

  use GroupherServer.CMS.Command.ConfirmationDefinition,
    operation: :category_create,
    operations: [:category_create, :category_update, :category_delete],
    data_keys: ["category_id", "command_id"],
    field_types: %{"category_id" => :integer, "command_id" => :string}
end
