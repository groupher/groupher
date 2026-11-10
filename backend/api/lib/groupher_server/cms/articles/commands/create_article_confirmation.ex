defmodule GroupherServer.CMS.Articles.Commands.CreateArticleConfirmation do
  @moduledoc """
  Stores Article and WorkingCopy identities for command retry recovery.

      createArticle transaction -> confirmation IDs -> Receipt replay result
  """
  use GroupherServer.CMS.Command.ConfirmationDefinition,
    operation: :article_create_article,
    data_keys: ["article_id", "working_copy_id", "command_id"],
    field_types: %{
      "article_id" => :string,
      "working_copy_id" => :string,
      "command_id" => :string
    }
end
