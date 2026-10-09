defmodule GroupherServer.CMS.Assets.Commands.RestoreAssetConfirmation do
  @moduledoc """
  Confirms one reversible community-asset restore.

      RestoreAsset -> Confirmation codec -> Receipt recovery
  """

  use GroupherServer.CMS.Command.ConfirmationDefinition,
    operation: :asset_restore,
    data_keys: ["asset_id", "command_id"],
    field_types: %{"asset_id" => :integer, "command_id" => :string}
end
