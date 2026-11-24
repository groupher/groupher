defmodule GroupherServer.CMS.Communities.Transaction do
  @moduledoc """
  Owns the transaction adapter used by Community lifecycle/setup operations.

      Community lifecycle / setup callback
        -> Communities.Transaction
        -> Communities.Persist / Effects
        -> commit or rollback
  """

  alias GroupherServer.Repo

  @doc "Runs a Community operation in the current transaction or opens one for a callback or Ecto.Multi."
  def run(fun) when is_function(fun, 0) do
    if Repo.in_transaction?(), do: {:ok, fun.()}, else: Repo.transaction(fun)
  end

  def run(%Ecto.Multi{} = multi), do: Repo.transaction(multi)
end
