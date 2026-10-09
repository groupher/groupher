defmodule Helper.ORM.AdvisoryLock do
  @moduledoc """
  Owns the PostgreSQL transaction-scoped advisory lock primitive.

      domain lock identity
          -> AdvisoryLock
          -> Repo connection / pg_advisory_xact_lock
          -> callback transaction

  Business modules own lock identity, ordering, telemetry, and error policy.
  This module only normalizes the key and executes the database primitive on
  the current transaction connection.
  """

  alias GroupherServer.Repo

  @doc "Acquires a transaction-scoped advisory lock on the current connection."
  @spec acquire!(binary() | integer()) :: {:ok, :acquired}
  def acquire!(lock_key) when is_integer(lock_key) or is_binary(lock_key) do
    Repo.query!("SELECT pg_advisory_xact_lock($1)", [normalize_key(lock_key)])
    {:ok, :acquired}
  end

  @doc "Runs a callback in a transaction while holding the normalized advisory lock."
  @spec transact(binary() | integer(), (-> term())) :: {:ok, term()} | {:error, term()}
  def transact(lock_key, fun)
      when (is_integer(lock_key) or is_binary(lock_key)) and is_function(fun, 0) do
    Repo.transaction(fn ->
      acquire!(lock_key)
      fun.()
    end)
  end

  defp normalize_key(lock_key) when is_integer(lock_key), do: lock_key

  defp normalize_key(lock_key) when is_binary(lock_key) do
    <<key::signed-64, _::binary>> = :crypto.hash(:sha256, lock_key)
    key
  end
end
