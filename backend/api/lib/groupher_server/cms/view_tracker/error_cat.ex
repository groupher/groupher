defmodule GroupherServer.CMS.ViewTracker.ErrorCat do
  @moduledoc """
  Stable errors owned by the Article ViewTracker boundary.

      ViewTracker transaction / query
        -> ViewTracker.ErrorCat
        -> GraphQL or job error serialization
  """

  use GroupherServer.ErrorCat.Domain, namespace: {:cms, :view_tracker}

  error(:unsupported_artiment, code: 4920)
  error(:receipt_identity_mismatch, code: 4921)
  error(:receipt_invalid_state, code: 4922)
  error(:target_not_found, code: 4923)
  error(:invalid_event_id, code: 4924)
  error(:missing_read_purpose, code: 4925)
  error(:invalid_read_purpose, code: 4926)
  error(:invalid_actor_type, code: 4927)
  error(:stats_not_found, code: 4928, retryable: true)
end
