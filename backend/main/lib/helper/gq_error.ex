defmodule Helper.GQLError do
  @moduledoc """
  Encode domain errors into GraphQL error shape.
  """

  alias Helper.{ErrorCode, Types}

  @spec encode(Types.error() | Types.gq_error() | {:error, Types.error()}) :: Types.gq_error()
  def encode({:error, [message: _message, code: _code]} = error), do: error
  def encode({:error, error}), do: encode(error)

  def encode({reason, meta}) when is_atom(reason) do
    message = if is_binary(meta), do: meta, else: Atom.to_string(reason)
    {:error, [message: message, code: safe_ecode(reason)]}
  end

  def encode(reason) when is_atom(reason) do
    {:error, [message: Atom.to_string(reason), code: safe_ecode(reason)]}
  end

  defp safe_ecode(reason), do: ErrorCode.ecode(reason)
end
