defmodule GroupherServer.CMS.DocTree.Commands.EnqueueConfirmation do
  @moduledoc """
  Persists the committed Queue revision for safe command replay.

      Docs command -> Confirmation -> Command Receipt -> replay result
  """

  use GroupherServer.CMS.Command.ConfirmationDefinition,
    operation: :doc_enqueue_queue,
    data_keys: ["community_id", "queue_revision"],
    field_types: %{"community_id" => :integer, "queue_revision" => :integer}
end
