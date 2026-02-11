defmodule Helper.GQL do
  @moduledoc """
  GraphQL boundary helpers for transforming domain results.
  """

  alias Helper.Types

  @spec result(Types.result(t, Types.error()) | Types.gq_result(t)) :: Types.gq_result(t)
  def result({:ok, _} = ok), do: ok
  def result({:error, [message: _, code: _]} = gq_error), do: gq_error
  def result({:error, error}), do: Helper.GQLError.encode(error)
end
