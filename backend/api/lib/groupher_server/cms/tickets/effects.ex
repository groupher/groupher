defmodule GroupherServer.CMS.Tickets.Effects do
  @moduledoc """
  Public boundary for Ticket cache and notification effects.

  Ticket Commands persist effect intents within their transaction. Internal
  cache and notification modules own payload construction and delivery.

      Ticket Command -> Tickets.Effects -> Outbox / Messaging adapter
  """

  alias GroupherServer.CMS
  alias CMS.Tickets.Effects.{Cache, Notifications}

  @doc """
  Records Ticket and linked Post cache tags in the caller transaction.

  ## Examples

      Effects.enqueue_cache(community, ticket_id, 42, [17], command_id, "published")
  """
  defdelegate enqueue_cache(
                community,
                ticket_id,
                inner_id,
                post_inner_ids,
                command_id,
                effect_key
              ),
              to: Cache,
              as: :enqueue

  @doc """
  Purges cache tags for Ticket projections affected by a Post stats change.

  ## Examples

      Effects.purge_post_cache(post_id)
  """
  defdelegate purge_post_cache(post_id), to: Cache, as: :purge_post

  @doc """
  Records an eligible Ticket Activity notification in the caller transaction.

  ## Examples

      Effects.enqueue_activity(community, ticket_state, activity, command_id)
  """
  defdelegate enqueue_activity(community, state, activity, command_id),
    to: Notifications

  @doc """
  Records an eligible public Ticket update notification in the caller transaction.

  ## Examples

      Effects.enqueue_update(community, ticket_state, update, command_id)
  """
  defdelegate enqueue_update(community, state, update, command_id), to: Notifications

  @doc """
  Delivers one Ticket notification Outbox event.

  ## Examples

      Effects.deliver_notification(event)
  """
  defdelegate deliver_notification(event), to: Notifications, as: :deliver
end
