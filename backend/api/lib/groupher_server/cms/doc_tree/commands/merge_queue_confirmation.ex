defmodule GroupherServer.CMS.DocTree.Commands.MergeQueueConfirmation do
  @moduledoc """
  Persists the committed Queue merge result for safe command replay.

      Docs command -> Confirmation -> Command Receipt -> replay result
  """

  use GroupherServer.CMS.Command.ConfirmationDefinition,
    operation: :docs_merge_queue,
    data_keys: ["community_id", "article_id", "queue_revision", "working_copy_revision"],
    field_types: %{
      "community_id" => :integer,
      "article_id" => :string,
      "queue_revision" => :integer,
      "working_copy_revision" => :integer
    }
end
