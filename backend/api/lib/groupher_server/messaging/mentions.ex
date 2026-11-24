defmodule GroupherServer.Messaging.Mentions do
  @moduledoc """
  Internal facade for Mention reads and persistence.

      Mention producer / inbox resolver
          -> Messaging.Mentions
          +--> Query for recipient-scoped pages and unread counts
          +--> Persist for idempotent target-revision deliveries
          -> typed query or persistence result

  Transaction ownership and mailbox projection updates remain with the
  command that invokes persistence.
  """

  alias __MODULE__.{Persist, Query}

  @doc "Runs `paged` through this capability boundary."
  defdelegate paged(user, filter, pagi), to: Query
  @doc "Runs `unread_count` through this capability boundary."
  defdelegate unread_count(user_id), to: Query
  @doc "Runs `unread_counts` through this capability boundary."
  defdelegate unread_counts(user_ids), to: Query
  @doc "Runs `replace` through this capability boundary."
  defdelegate replace(content, mentions, from_user), to: Persist
end
