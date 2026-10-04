defmodule GroupherServer.CMS.Communities.RequestDestroyConfirmation do
  @moduledoc """
  Confirms a Community destroy request.

      community_request_destroy -> encode -> Receipt -> decode on retry
  """

  use GroupherServer.CMS.Command.ConfirmationDefinition,
    operation: :community_request_destroy,
    data_keys: ["community_id", "community_slug", "operation_ref"],
    field_types: %{
      "community_id" => :string,
      "community_slug" => :string,
      "operation_ref" => :string
    }
end
