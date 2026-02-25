defmodule Helper.GQL do
  @moduledoc """
  GraphQL boundary helpers for transforming domain results.
  """

  alias Helper.T

  @spec result(T.result(term(), T.error()) | T.gq_result(term())) ::
          T.gq_result(term())
  def result({:ok, _} = ok), do: ok
  def result({:error, {:changeset, %Ecto.Changeset{} = changeset}}), do: {:error, changeset}
  def result({:error, [message: _, code: _]} = gq_error), do: gq_error
  def result({:error, error}), do: Helper.GQLError.encode(error)
end
