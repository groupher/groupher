defmodule GroupherServer.CMS.Assets.Commands.ReplaceUseConfirmation do
  @moduledoc """
  Confirms one Article asset replacement operation.

      article_replace_asset -> encode -> Receipt -> decode on retry
  """

  use GroupherServer.CMS.Command.ConfirmationDefinition,
    operation: :article_replace_asset,
    data_keys: [
      "article_id",
      "command_id",
      "draft_version",
      "from_asset_id",
      "ref_id",
      "to_asset_id",
      "usage"
    ],
    field_types: %{
      "article_id" => :string,
      "command_id" => :string,
      "draft_version" => :integer,
      "from_asset_id" => :integer,
      "ref_id" => :integer,
      "to_asset_id" => :integer,
      "usage" => :string
    }
end
