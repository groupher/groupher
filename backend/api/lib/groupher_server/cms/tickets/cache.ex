defmodule GroupherServer.CMS.Tickets.Cache do
  @moduledoc """
  Public facade for Ticket cache effects.

  Ticket commands and existing Post interaction workflows enter through this
  module; durable intents and delivery behavior belong to `Tickets.Effects.Cache`.

      Ticket/Post mutation -> Tickets.Cache -> Outbox -> PublicCache purge
  """

  alias GroupherServer.CMS
  alias CMS.Tickets.Effects

  defdelegate enqueue(community, ticket_id, inner_id, post_inner_ids, command_id, effect_key),
    to: Effects,
    as: :enqueue_cache

  defdelegate purge_post(post_id), to: Effects, as: :purge_post_cache
end
