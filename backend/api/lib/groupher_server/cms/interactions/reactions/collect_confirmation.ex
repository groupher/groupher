defmodule GroupherServer.CMS.Interactions.Reactions.CollectConfirmation do
  @moduledoc """
  Confirms either variant of the Article collect set-state command.

      collect add/remove -> reaction Receipt -> decode

  The reaction operation is deliberately separate from the Accounts
  collect-folder operation. Both may reuse one client command id during a
  folder mutation without claiming the same receipt row with different intent.
  """

  use GroupherServer.CMS.Command.ConfirmationDefinition,
    operation: :reaction_collect_add,
    operations: [:reaction_collect_add, :reaction_collect_remove],
    data_keys: ["operation", "outcome", "target_id", "target_type"],
    field_types: %{
      "operation" => :string,
      "outcome" => :string,
      "target_id" => :string,
      "target_type" => :string
    },
    variant_key: "operation"
end
