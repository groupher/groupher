defmodule GroupherServer.CMS.Articles.Commands.TrashConfirmation do
  @moduledoc """
  Confirms an Article trash transition.

      article_trash -> encode -> Receipt -> decode on retry
  """

  use GroupherServer.CMS.Command.ConfirmationDefinition,
    operation: :article_trash,
    data_keys: ["article_id", "command_id", "trash_id"],
    field_types: %{
      "article_id" => :string,
      "command_id" => :string,
      "trash_id" => :string
    }
end
