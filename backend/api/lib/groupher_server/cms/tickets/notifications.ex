defmodule GroupherServer.CMS.Tickets.Notifications do
  @moduledoc """
  Public facade for Ticket notification effects.

      Ticket command -> Notifications facade -> durable Outbox delivery
  """

  alias GroupherServer.CMS
  alias CMS.Tickets.Effects

  @doc "Queues a Ticket Activity notification under the supplied command identity."
  defdelegate enqueue_activity(community, state, activity, command_id),
    to: Effects

  @doc "Queues a Ticket update notification under the supplied command identity."
  defdelegate enqueue_update(community, state, update, command_id), to: Effects

  @doc "Delivers a queued Ticket notification event."
  defdelegate deliver(event), to: Effects, as: :deliver_notification
end
