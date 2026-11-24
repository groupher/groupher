defmodule GroupherServer.CMS.Tickets.Cache do
  @moduledoc """
  Public facade for Ticket cache effects.

  Ticket commands and existing Post interaction workflows enter through this
  module; durable intents and delivery behavior belong to `Tickets.Effects.Cache`.

      Ticket/Post mutation -> Tickets.Cache -> Outbox -> PublicCache purge
  """

  alias GroupherServer.CMS
  alias CMS.Tickets.Effects

  @doc "Invalidates and refreshes Ticket projections affected by a command."
  defdelegate projection_changed(community, state, binding, post_inner_ids, operation_ref),
    to: Effects

  @doc "Purges Ticket projection cache entries associated with a Post."
  defdelegate purge_post(post_id), to: Effects, as: :purge_post_cache
end
