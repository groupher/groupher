defmodule GroupherServer.CMS.Communities.Subscriptions.Confirmation do
  @moduledoc """
  Receipt codec for subscribe/unsubscribe results.

      Command result -> Confirmation.encode -> Receipt -> Confirmation.decode -> result builder
  """

  use GroupherServer.CMS.Command.ConfirmationDefinition,
    operation: :community_subscribe,
    operations: [:community_subscribe, :community_unsubscribe],
    data_keys: ["community_id", "command_id"],
    field_types: %{"community_id" => :integer, "command_id" => :string}
end
