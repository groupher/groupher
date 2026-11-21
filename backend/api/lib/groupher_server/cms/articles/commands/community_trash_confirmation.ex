defmodule GroupherServer.CMS.Articles.Commands.CommunityTrashConfirmation do
  @moduledoc """
  Stores the immutable result of a Community Binding hide or restore.

      Command -> confirmation -> stable replay result
  """
  use GroupherServer.CMS.Command.ConfirmationDefinition,
    operation: :community_article_hide,
    operations: [:community_article_hide, :community_article_restore],
    data_keys: [
      "id",
      "article_id",
      "community_id",
      "binding_id",
      "thread",
      "hidden_at",
      "action",
      "command_id"
    ],
    field_types: %{
      "id" => :string,
      "article_id" => :string,
      "community_id" => :integer,
      "binding_id" => :integer,
      "thread" => :string,
      "hidden_at" => :string,
      "action" => :string,
      "command_id" => :string
    }
end
