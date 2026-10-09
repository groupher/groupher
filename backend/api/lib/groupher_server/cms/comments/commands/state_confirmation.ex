defmodule GroupherServer.CMS.Comments.Commands.StateConfirmation do
  @moduledoc """
  Confirms retry-safe Comment pin state changes.

      pin/unpin command -> stable comment state + command id -> Receipt recovery
  """

  use GroupherServer.CMS.Command.ConfirmationDefinition,
    operation: :comment_pin,
    operations: [:comment_pin, :comment_unpin],
    data_keys: ["article_id", "comment_id", "command_id", "state"],
    field_types: %{
      "article_id" => :string,
      "comment_id" => :string,
      "command_id" => :string,
      "state" => :string
    }
end
