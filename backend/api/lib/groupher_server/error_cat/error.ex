defmodule GroupherServer.ErrorCat.Error do
  @moduledoc """
  A declared, structured application error.

  The namespace and reason identify the declaration.  The remaining fields are
  resolved from the owning catalog and are therefore not handwritten by
  callers.

  Catalog entry -> normalized Error struct -> protocol boundary.
  """

  @enforce_keys [:namespace, :reason, :code, :retryable, :actions, :message_key]
  defstruct [:namespace, :reason, :code, :retryable, :actions, :message_key, :details]

  @type t :: %__MODULE__{
          namespace: tuple(),
          reason: atom(),
          code: pos_integer(),
          retryable: boolean(),
          actions: [atom()],
          message_key: String.t(),
          details: term()
        }
end
