defmodule GroupherServer.CMS.Interactions.Reactions.ReportConfirmation do
  @moduledoc """
  Confirms either variant of the report command.

      report add/remove -> Confirmation -> Receipt recovery
  """

  use GroupherServer.CMS.Command.ConfirmationDefinition,
    operation: :report_add,
    operations: [:report_add, :report_remove],
    data_keys: ["target_id", "target_type"],
    field_types: %{
      "target_id" => :string,
      "target_type" => :string
    }
end
