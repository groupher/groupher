defmodule GroupherServer.CMS.CommunityApplications.Commands.Confirmation do
  @moduledoc """
  Receipt codec for Community Application commands.

      Application Command -> Confirmation.encode -> Receipt -> Confirmation.decode -> result
  """

  use GroupherServer.CMS.Command.ConfirmationDefinition,
    operation: :community_application_submit,
    operations: [
      :community_application_submit,
      :community_application_cancel,
      :community_application_review,
      :community_application_approve,
      :community_application_reject,
      :community_application_retry_creation,
      :community_application_retry_setup
    ],
    data_keys: ["application_id", "command_id"],
    field_types: %{"application_id" => :integer, "command_id" => :string}
end
