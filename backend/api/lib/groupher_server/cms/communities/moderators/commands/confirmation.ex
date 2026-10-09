defmodule GroupherServer.CMS.Communities.Moderators.Commands.Confirmation do
  @moduledoc """
  Receipt codec for moderator mutations.

  `results` is deliberately a JSON list: AddMany is partial-success by
  contract, so a retry must recover which target users succeeded or failed.

      Moderator Command -> Confirmation codec -> Receipt recovery
  """

  use GroupherServer.CMS.Command.ConfirmationDefinition,
    operation: :moderator_add,
    operations: [:moderator_add, :moderator_add_many, :moderator_remove, :moderator_update],
    data_keys: ["community_id", "command_id", "results"],
    field_types: %{"community_id" => :integer, "command_id" => :string, "results" => :json}
end
