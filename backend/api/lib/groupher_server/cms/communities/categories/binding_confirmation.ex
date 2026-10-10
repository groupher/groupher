defmodule GroupherServer.CMS.Communities.Categories.BindingConfirmation do
  @moduledoc """
  Encodes Community Category association results for Receipt recovery.

      set/unset category -> BindingConfirmation -> Receipt -> Community reload
  """

  use GroupherServer.CMS.Command.ConfirmationDefinition,
    operation: :category_set,
    operations: [:category_set, :category_unset],
    data_keys: ["community_id", "command_id"],
    field_types: %{"community_id" => :integer, "command_id" => :string}
end
