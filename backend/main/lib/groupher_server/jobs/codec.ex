defmodule GroupherServer.Jobs.Codec do
  @moduledoc false

  @spec encode(term()) :: String.t()
  def encode(term) do
    term
    |> :erlang.term_to_binary()
    |> Base.encode64()
  end

  @spec decode(String.t()) :: term()
  def decode(encoded) when is_binary(encoded) do
    encoded
    |> Base.decode64!()
    |> :erlang.binary_to_term([:safe])
  end
end
