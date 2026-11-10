defmodule GroupherServer.CMS.Articles.Commands.CreateAndPublishArticleConfirmation do
  @moduledoc """
  Stores only the identities needed to reconstruct a retried first publication.

      Article creation transaction -> confirmation IDs -> Receipt replay result
  """
  use GroupherServer.CMS.Command.ConfirmationDefinition,
    operation: :article_create_and_publish_article,
    data_keys: ["article_id", "working_copy_id", "snapshot_id", "command_id"],
    field_types: %{
      "article_id" => :string,
      "working_copy_id" => :string,
      "snapshot_id" => :string,
      "command_id" => :string
    }
end
