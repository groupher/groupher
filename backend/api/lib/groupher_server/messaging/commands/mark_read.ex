defmodule GroupherServer.Messaging.Commands.MarkRead do
  @moduledoc """
  Owns the user action that marks selected inbox rows as read.

      Messaging facade
          -> MarkRead command
          -> Inbox.Persist
          -> typed update result
  """

  use GroupherServer.CommandPipeline

  alias GroupherServer.Messaging

  alias Messaging.Inbox.Persist

  @pipeline operation: :messaging_mark_read, access: :open, target: :user, params: [:type, :ids]

  direct_pipeline run(type, ids, user) do
    change(fn _user, _operation_ref -> Persist.mark_read(type, ids, user) end)
  end

  @doc """
  Marks selected mention or notification rows as read.

  ## Examples

      Messaging.Commands.MarkRead.run(:mention, ids, user)
  """
end
