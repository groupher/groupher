defmodule GroupherServer.CMS.DocTree.Commands.DequeueConfirmation do
  @moduledoc """
  Stores the committed Queue revision after member removal.

      Docs command -> Confirmation -> Command Receipt -> replay result
  """
  use GroupherServer.CMS.Command.ConfirmationDefinition,
    operation: :docs_dequeue,
    data_keys: ["community_id", "queue_revision"],
    field_types: %{"community_id" => :integer, "queue_revision" => :integer}
end
