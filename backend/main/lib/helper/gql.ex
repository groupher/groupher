defmodule Helper.GQL do
  @moduledoc """
  GraphQL boundary helpers for transforming domain results.
  """

  alias Helper.Types

  @spec result(Types.result(term(), Types.error()) | Types.gq_result(term())) ::
          Types.gq_result(term())
  def result({:ok, _} = ok), do: ok
  def result({:error, {:changeset, %Ecto.Changeset{} = changeset}}), do: {:error, changeset}
  def result({:error, [message: _, code: _]} = gq_error), do: gq_error
  def result({:error, error}), do: Helper.GQLError.encode(error)
end
