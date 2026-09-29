defmodule GroupherServer.CMS.ViewTracker.ErrorCat do
  @moduledoc """
  Stable errors owned by the Article ViewTracker boundary.

      ViewTracker transaction / query
        -> ViewTracker.ErrorCat
        -> GraphQL or job error serialization
  """

  use GroupherServer.ErrorCat.Domain, namespace: {:cms, :view_tracker}

  error(:unsupported_artiment, code: 4920)
  error(:target_not_found, code: 4923)
  error(:missing_read_purpose, code: 4925)
  error(:invalid_read_purpose, code: 4926)
  error(:invalid_actor_type, code: 4927)
  error(:stats_not_found, code: 4928, retryable: true)
end
