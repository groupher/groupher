defmodule GroupherServer.CMS.DocTree.Commands.NodeDraftConfirmation do
  @moduledoc """
  Confirms one DocTree draft update.

      doc_update_draft -> encode -> Receipt -> decode on retry
  """

  use GroupherServer.CMS.Command.ConfirmationDefinition,
    operation: :doc_update_draft,
    data_keys: [
      "article_id",
      "community_id",
      "branch_id",
      "version",
      "title",
      "subtitle",
      "slug",
      "digest",
      "content_hash",
      "updated_at",
      "command_id"
    ],
    field_types: %{
      "article_id" => :string,
      "community_id" => :integer,
      "branch_id" => :integer,
      "version" => :integer,
      "title" => :string,
      "subtitle" => {:nullable, :string},
      "slug" => {:nullable, :string},
      "digest" => {:nullable, :string},
      "content_hash" => :string,
      "updated_at" => :string,
      "command_id" => :string
    }
end
