defmodule GroupherServer.CMS.Articles.Commands.BindingConfirmation do
  @moduledoc """
  Encodes the stable result identity shared by Community-local Article commands.

      binding command -> strict confirmation envelope -> CommandReceipt replay
  """

  use GroupherServer.CMS.Command.ConfirmationDefinition,
    operation: :article_mirror,
    operations: [:article_mirror, :article_move, :article_unmirror, :article_pin, :article_unpin],
    data_keys: ["article_id", "community_id", "command_id"],
    field_types: %{
      "article_id" => :string,
      "community_id" => :integer,
      "command_id" => :string
    }
end
