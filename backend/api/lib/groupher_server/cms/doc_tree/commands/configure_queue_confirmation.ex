defmodule GroupherServer.CMS.DocTree.Commands.ConfigureQueueConfirmation do
  @moduledoc """
  Keeps the original approval configuration result for command replay.

      ConfigureQueue -> immutable confirmation -> replay without another policy update
  """
  use GroupherServer.CMS.Command.ConfirmationDefinition,
    operation: :docs_configure_queue,
    data_keys: ["community_id", "revision", "required", "self_approval"],
    field_types: %{
      "community_id" => :integer,
      "revision" => :integer,
      "required" => :boolean,
      "self_approval" => :boolean
    }
end
