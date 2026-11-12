defmodule GroupherServer.CMS.DocTree.Commands.ResolvePostPublishConfirmation do
  @moduledoc """
  Stores the committed default-copy revision for conflict-resolution replay.

      ResolvePostPublish -> Confirmation -> Command Receipt -> replay result
  """

  use GroupherServer.CMS.Command.ConfirmationDefinition,
    operation: :docs_resolve_post_publish,
    data_keys: ["community_id", "article_id", "working_copy_revision"],
    field_types: %{
      "community_id" => :integer,
      "article_id" => :string,
      "working_copy_revision" => {:nullable, :integer}
    }
end
