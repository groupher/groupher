defmodule GroupherServer.CMS.Assets.Commands.DeleteAssetConfirmation do
  @moduledoc """
  Confirms one terminal Asset deletion.

  The deleted row remains addressable by id for result recovery; the
  confirmation stores only the stable identity required to reload it.

      DeleteAsset -> Confirmation codec -> Receipt recovery / result builder
  """

  use GroupherServer.CMS.Command.ConfirmationDefinition,
    operation: :asset_delete,
    data_keys: ["asset_id", "command_id"],
    field_types: %{
      "asset_id" => :integer,
      "command_id" => :string
    }
end
