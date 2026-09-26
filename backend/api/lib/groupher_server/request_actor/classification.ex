defmodule GroupherServer.RequestActor.Classification do
  @moduledoc """
  Immutable classification result shared by request consumers.

  Business position:

      RequestActor.classify/1 -> Classification -> ViewTracker, Analysis, and other consumers
  """

  @enforce_keys [:type, :is_authenticated, :confidence, :classified_by]
  defstruct [:type, :is_authenticated, :confidence, :classified_by]

  @type t :: %__MODULE__{
          type: :human | :agent | :crawler | :unknown,
          is_authenticated: boolean(),
          confidence: :verified | :probable | :unknown,
          classified_by:
            :account_session
            | :signed_anonymous_session
            | :agent_credential
            | :delegation_credential
            | :verified_crawler
            | :self_reported
            | :fallback
        }
end
