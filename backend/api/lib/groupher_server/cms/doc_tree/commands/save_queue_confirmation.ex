defmodule GroupherServer.CMS.DocTree.Commands.SaveQueueConfirmation do
  @moduledoc """
  Persists a committed Queue copy revision for command replay.

      Docs command -> Confirmation -> Command Receipt -> replay result
  """

  use GroupherServer.CMS.Command.ConfirmationDefinition,
    operation: :docs_save_queue,
    data_keys: ["community_id", "article_id", "queue_revision", "working_copy_revision"],
    field_types: %{
      "community_id" => :integer,
      "article_id" => :string,
      "queue_revision" => :integer,
      "working_copy_revision" => :integer
    }
end
