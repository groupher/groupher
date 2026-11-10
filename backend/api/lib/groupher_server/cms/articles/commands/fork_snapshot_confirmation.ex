defmodule GroupherServer.CMS.Articles.Commands.ForkSnapshotConfirmation do
  @moduledoc """
  Stores the new WorkingCopy identity used to rebuild the fork result on retry.

      forkSnapshot transaction -> Article / WorkingCopy IDs -> Receipt replay result
  """
  use GroupherServer.CMS.Command.ConfirmationDefinition,
    operation: :article_fork_snapshot,
    data_keys: ["article_id", "working_copy_id", "command_id"],
    field_types: %{
      "article_id" => :string,
      "working_copy_id" => :string,
      "command_id" => :string
    }
end
