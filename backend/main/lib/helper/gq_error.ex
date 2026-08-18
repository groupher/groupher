defmodule Helper.GQLError do
  @moduledoc """
  Encode domain errors into GraphQL error shape.

  Business position:

      Domain or web caller
        -> GQLError
        -> normalized value / infrastructure
  """

  alias Helper.{ErrorCode, T}

  @spec encode(T.error() | T.gq_error() | {:error, T.error()}) :: T.gq_error()
  @doc "Encodes  for the `GQLError` protocol boundary."
  def encode({:error, [message: _message, code: _code]} = error), do: error
  def encode({:error, error}), do: encode(error)

  # Projection writes are infrastructure failures, not a public domain reason.
  # Keep the internal atom out of the GraphQL message and reuse the stable
  # update-failure code already used by persistence boundaries.
  def encode(:projection_not_updated),
    do: {:error, [message: "当前操作暂不可执行，请稍后重试。", code: ErrorCode.ecode(:update_fails)]}

  def encode({reason, meta}) when is_atom(reason) do
    message = if is_binary(meta), do: meta, else: Atom.to_string(reason)
    {:error, [message: message, code: safe_ecode(reason)]}
  end

  def encode(reason) when is_atom(reason) do
    {:error, [message: Atom.to_string(reason), code: safe_ecode(reason)]}
  end

  defp safe_ecode(reason), do: ErrorCode.ecode(reason)
end
