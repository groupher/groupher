defmodule GroupherServer.CMS.Tickets.Notifications do
  @moduledoc """
  Public facade for Ticket notification effects.

      Ticket command -> Notifications facade -> durable Outbox delivery
  """

  alias GroupherServer.CMS.Tickets.Effects

  defdelegate enqueue_activity(community, state, activity, command_id),
    to: Effects

  defdelegate enqueue_update(community, state, update, command_id), to: Effects

  defdelegate deliver(event), to: Effects, as: :deliver_notification
end
