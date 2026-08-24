defmodule GroupherServer.Activity.ErrorCat do
  @moduledoc """
  Declares stable Activity domain errors and codes.

      Activity boundary -> Activity ErrorCat -> protocol formatter
  """

  use GroupherServer.ErrorCat.Domain, namespace: {:activity}

  error(:invalid_action, code: 6101)
  error(:unsupported_action, code: 6102)
  error(:unsupported_resource, code: 6103)
  error(:surface_not_exposed, code: 6104)
  error(:undeclared_payload, code: 6105)
  error(:invalid_payload, code: 6106)
  error(:invalid_target, code: 6107)
  error(:invalid_actor, code: 6108)
  error(:invalid_source, code: 6109)
  error(:invalid_event_ref, code: 6110)
  error(:invalid_operation_ref, code: 6111)
  error(:invalid_parent_event_ref, code: 6112)
  error(:invalid_occurred_at, code: 6114)
  error(:invalid_pagination, code: 6115)
  error(:invalid_event_sequence, code: 6116)
  error(:duplicate_event, code: 6117)
  error(:append_failed, code: 6118)
end
