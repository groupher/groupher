defmodule GroupherServer.CMS.Interactions.ErrorCat do
  @moduledoc """
  Stable domain errors owned by the Artiment Interaction facade.

      Interaction command / query scope
        -> Interactions.ErrorCat
        -> GraphQL error serialization
  """

  use GroupherServer.ErrorCat.Domain, namespace: {:cms, :interaction}

  error(:unsupported_artiment, code: 4901)
  error(:unsupported_artiment_query, code: 4902)
  error(:unsupported_order, code: 4903)
  error(:emotion_not_allowed, code: 4904)
  error(:already_reported, code: 4905)
  error(:view_event_identity_mismatch, code: 4906)
  error(:interaction_state_conflict, code: 4907)
  error(:view_event_insert_failed, code: 4908)
  error(:target_not_found, code: 4909)
  error(:unknown_emotion, code: 4910)
  error(:invalid_event_id, code: 4911)
end
