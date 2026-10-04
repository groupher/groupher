defmodule GroupherServer.CMS.DocTree.Commands.PublishChangesConfirmation do
  @moduledoc """
  Confirms a DocTree publish-changes operation.

      doc_publish_changes -> encode -> Receipt -> decode on retry
  """

  use GroupherServer.CMS.Command.ConfirmationDefinition,
    operation: :doc_publish_changes,
    data_keys: ["done", "release_id"],
    field_types: %{"done" => :boolean, "release_id" => {:nullable, :string}}
end
