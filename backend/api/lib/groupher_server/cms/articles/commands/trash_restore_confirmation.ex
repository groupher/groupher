defmodule GroupherServer.CMS.Articles.Commands.TrashRestoreConfirmation do
  @moduledoc """
  Confirms an Article restore transition.

      article_restore -> encode -> Receipt -> decode on retry
  """

  use GroupherServer.CMS.Command.ConfirmationDefinition,
    operation: :article_restore,
    data_keys: ["article_id", "command_id"],
    field_types: %{"article_id" => :string, "command_id" => :string}
end
