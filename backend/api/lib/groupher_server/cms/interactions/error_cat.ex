defmodule GroupherServer.CMS.Interactions.ErrorCat do
  @moduledoc """
  Stable domain errors owned by the Artiment Interaction facade.

      Interaction command / query scope
        -> Interactions.ErrorCat
        -> GraphQL error serialization
  """

  use GroupherServer.ErrorCat, namespace: {:cms, :interaction}

  error(:unsupported_artiment, code: 4901)
  error(:unsupported_artiment_query, code: 4902)
  error(:unsupported_order, code: 4903)
  error(:emotion_not_allowed, code: 4904)
  error(:interaction_state_conflict, code: 4907)
  error(:unknown_emotion, code: 4910)
  error(:projection_not_updated, code: 4912, retryable: true)
  error(:interaction_target_not_found, code: 4913, retryable: true)
  error(:interaction_target_invalid, code: 4914, retryable: true)
  error(:interaction_actor_not_found, code: 4915, retryable: true)
  error(:interaction_actor_invalid, code: 4916, retryable: true)
end
