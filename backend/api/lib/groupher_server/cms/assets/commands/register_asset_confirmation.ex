defmodule GroupherServer.CMS.Assets.Commands.RegisterAssetConfirmation do
  @moduledoc """
  Confirms one community-asset registration.

  The receipt stores the canonical asset id so a lost response can rebuild the
  same asset projection without running the upsert a second time.

      RegisterAsset -> Confirmation codec -> Receipt recovery
  """

  use GroupherServer.CMS.Command.ConfirmationDefinition,
    operation: :asset_register,
    data_keys: ["asset_id", "command_id"],
    field_types: %{"asset_id" => :integer, "command_id" => :string}
end
