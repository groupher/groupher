defmodule GroupherServer.CMS.Articles.Commands.TrashPermanentDeleteConfirmation do
  @moduledoc """
  Confirms an Article permanent-delete transition.

      article_permanently_delete -> encode -> Receipt -> decode on retry
  """

  use GroupherServer.CMS.Command.ConfirmationDefinition,
    operation: :article_permanently_delete,
    data_keys: ["command_id", "done"],
    field_types: %{"command_id" => :string, "done" => :boolean}
end
