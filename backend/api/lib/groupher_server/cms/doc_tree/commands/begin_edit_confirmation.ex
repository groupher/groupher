defmodule GroupherServer.CMS.DocTree.Commands.BeginEditConfirmation do
  @moduledoc """
  Keeps the original editing identity for replay without recreating deleted copies.

      BeginEdit -> Confirmation -> Receipt -> original D identity
  """
  use GroupherServer.CMS.Command.ConfirmationDefinition,
    operation: :docs_begin_edit,
    data_keys: ["community_id", "article_id", "working_copy_id", "revision"],
    field_types: %{
      "community_id" => :integer,
      "article_id" => :string,
      "working_copy_id" => :string,
      "revision" => :integer
    }
end
