defmodule GroupherServer.CMS.DocTree.Commands.ApproveQueueConfirmation do
  @moduledoc """
  Records the sealed Queue approval identity for safe command replay.

      ApproveQueue -> Confirmation -> Command Receipt -> approval result
  """
  use GroupherServer.CMS.Command.ConfirmationDefinition,
    operation: :docs_approve_queue,
    data_keys: ["community_id", "approval_id", "queue_revision"],
    field_types: %{
      "community_id" => :integer,
      "approval_id" => :string,
      "queue_revision" => :integer
    }
end
