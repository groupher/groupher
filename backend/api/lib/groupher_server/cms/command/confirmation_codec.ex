defmodule GroupherServer.CMS.Command.ConfirmationCodec do
  @moduledoc """
  Defines the codec boundary for durable Command confirmations.

  The codec owns the domain struct and its strict JSON representation. The
  shared Command runner only validates the operation, persists the object and
  decodes it on a completed retry.

  `operations/0` is the complete closed set accepted by the codec. `encode/2`
  must return a JSON-safe string-key object and both callbacks must fail closed
  with `{:error, reason}` for an unsupported operation, struct or payload.

      CMS.Command
        -> validate operations/0
        -> encode the domain Confirmation
        -> Receipt JSON
        -> decode the same operation on retry
  """

  @callback operations() :: nonempty_list(atom())
  @callback encode(struct(), atom()) :: {:ok, map()} | {:error, term()}
  @callback decode(map(), atom()) :: {:ok, struct()} | {:error, term()}
end
