defmodule GroupherServer.CMS.DocTree.Commands.RestoreSnapshotConfirmation do
  @moduledoc """
  Stores the original restored D identity for replay.

      Snapshot restoration -> Confirmation -> Receipt -> original saved revision
  """
  use GroupherServer.CMS.Command.ConfirmationDefinition,
    operation: :docs_restore_snapshot,
    data_keys: ["community_id", "article_id", "working_copy_id", "revision"],
    field_types: %{
      "community_id" => :integer,
      "article_id" => :string,
      "working_copy_id" => :string,
      "revision" => :integer
    }
end
