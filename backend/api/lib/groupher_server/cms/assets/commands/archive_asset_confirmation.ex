defmodule GroupherServer.CMS.Assets.Commands.ArchiveAssetConfirmation do
  @moduledoc """
  Confirms one reversible community-asset archive.

      ArchiveAsset -> Confirmation codec -> Receipt recovery
  """

  use GroupherServer.CMS.Command.ConfirmationDefinition,
    operation: :asset_archive,
    data_keys: ["asset_id", "command_id"],
    field_types: %{"asset_id" => :integer, "command_id" => :string}
end
