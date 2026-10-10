defmodule GroupherServer.CMS.Comments.Commands.SolutionConfirmation do
  @moduledoc """
  Confirms one Comment solution command for Receipt recovery.

      accept/revoke solution -> stable binding state + command id -> Receipt
  """

  use GroupherServer.CMS.Command.ConfirmationDefinition,
    operation: :comment_accept_solution,
    operations: [:comment_accept_solution, :comment_revoke_solution],
    data_keys: ["article_id", "comment_id", "command_id", "state"],
    field_types: %{
      "article_id" => :string,
      "comment_id" => :string,
      "command_id" => :string,
      "state" => :string
    }
end
