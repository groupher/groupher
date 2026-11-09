defmodule GroupherServer.CMS.Tickets.ErrorCat do
  @moduledoc """
  Assigns stable domain errors to Ticket reads, lifecycle changes and relations.

      Ticket operation failure
        -> namespaced Ticket error
        -> shared CMS/GraphQL error handling
  """

  use GroupherServer.ErrorCat, namespace: {:cms, :ticket}

  error(:not_found, code: 6301)
  error(:version_conflict, code: 6302)
  error(:invalid_transition, code: 6303)
  error(:worker_required, code: 6304)
  error(:workers_incomplete, code: 6305)
  error(:parent_ticket_done, code: 6306)
  error(:community_mismatch, code: 6307)
  error(:post_not_public, code: 6308)
  error(:invalid_ticket_type, code: 6309)
  error(:invalid_ticket_content, code: 6310)
  error(:ticket_is_held, code: 6311)
  error(:invalid_visibility_transition, code: 6312)
  error(:assignee_not_member, code: 6313)
end
