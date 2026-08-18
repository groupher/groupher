defmodule GroupherServer.CMS.Events.Event do
  @moduledoc """
  Common event envelope for CMS event handlers.

  Business position:

      Domain write
        -> CMS.Events
        -> Event
        -> bounded side effect
  """

  @enforce_keys [:type, :payload]
  defstruct [:type, :payload, meta: %{}]

  @type t :: %__MODULE__{
          type: atom(),
          payload: map(),
          meta: map()
        }
end
