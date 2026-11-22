defmodule GroupherServer.CMS.DocTree.Commands.ReleaseQueueConfirmation do
  @moduledoc """
  Persists the committed Docs Release identity for safe command replay.

      Docs command -> Confirmation -> Command Receipt -> replay result
  """

  use GroupherServer.CMS.Command.ConfirmationDefinition,
    operation: :doc_release_queue,
    data_keys: ["community_id", "release_id", "queue_revision"],
    field_types: %{
      "community_id" => :integer,
      "release_id" => :integer,
      "queue_revision" => :integer
    }
end
