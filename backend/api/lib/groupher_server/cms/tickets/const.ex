defmodule GroupherServer.CMS.Tickets.Const do
  @moduledoc """
  Closed Tickets vocabulary for externally visible lifecycle causes.

      Post or Community visibility change
        -> Tickets.Const visibility cause
          -> Activity metadata and Outbox effect key
  """

  use GroupherServer.Const

  @visibility_causes [
    :post_trash,
    :post_restore,
    :post_review_block,
    :community_visibility,
    :ticket_review_block_resolved
  ]

  enum(visibility_cause, do: Enum.map(@visibility_causes, &{&1, &1}))

  def cause_value(cause) when cause in @visibility_causes, do: Atom.to_string(cause)
end
