defmodule GroupherServer.CMS.Interactions.Reactions.UpvoteConfirmation do
  @moduledoc """
  Confirms either variant of the shared upvote set-state command.

      upvote add/remove -> encode with variant tag -> Receipt -> decode
  """

  use GroupherServer.CMS.Command.ConfirmationDefinition,
    operation: :upvote_add,
    operations: [:upvote_add, :upvote_remove],
    data_keys: ["operation", "outcome", "target_id", "target_type"],
    field_types: %{
      "operation" => :string,
      "outcome" => :string,
      "target_id" => :string,
      "target_type" => :string
    },
    variant_key: "operation"
end
