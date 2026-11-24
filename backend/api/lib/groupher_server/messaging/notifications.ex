defmodule GroupherServer.Messaging.Notifications do
  @moduledoc """
  Read facade for legacy Notification projections.

      Notification resolver
          -> Messaging.Notifications
          -> Notifications.Query
          -> recipient-scoped page or unread-count result
  """

  alias __MODULE__.Query

  @doc "Runs `paged` through this capability boundary."
  defdelegate paged(user, filter, pagi), to: Query
  @doc "Runs `unread_count` through this capability boundary."
  defdelegate unread_count(user_id), to: Query
  @doc "Runs `unread_counts` through this capability boundary."
  defdelegate unread_counts(user_ids), to: Query
end
