defmodule GroupherServer.CMS.Comments.Commands.CommentConfirmation do
  @moduledoc """
  Confirms one Comment write using the shared stable Comment identity contract.

      comment create / reply / update / delete
        -> CommentConfirmation
        -> Receipt persistence / recovery
  """

  use GroupherServer.CMS.Command.ConfirmationDefinition,
    operation: :comment_create,
    operations: [:comment_create, :comment_reply, :comment_update, :comment_delete],
    data_keys: ["article_id", "comment_id", "command_id"],
    field_types: %{
      "article_id" => :string,
      "comment_id" => :string,
      "command_id" => :string
    }
end
