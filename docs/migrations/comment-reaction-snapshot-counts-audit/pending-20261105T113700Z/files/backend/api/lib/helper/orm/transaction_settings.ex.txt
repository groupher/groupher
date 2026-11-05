defmodule Helper.ORM.TransactionSettings do
  @moduledoc """
  Owns transaction-local PostgreSQL timeout settings.

      transaction owner
          -> TransactionSettings.configure!/2
          -> set_config(..., true)
          -> current transaction connection

  The `true` transaction-local flag is intentional: settings must not leak to
  a pooled connection after the owner transaction completes.
  """

  alias GroupherServer.Repo

  @doc "Sets statement and lock timeout values for the current transaction."
  @spec configure!(pos_integer(), pos_integer()) :: {:ok, :configured}
  def configure!(statement_timeout_ms, lock_timeout_ms)
      when is_integer(statement_timeout_ms) and statement_timeout_ms > 0 and
             is_integer(lock_timeout_ms) and lock_timeout_ms > 0 do
    set_config!("statement_timeout", statement_timeout_ms)
    set_config!("lock_timeout", lock_timeout_ms)
    {:ok, :configured}
  end

  @doc "Sets one transaction-local PostgreSQL setting."
  @spec set_config!(String.t(), pos_integer()) :: {:ok, :configured}
  def set_config!(name, value) when is_binary(name) and is_integer(value) and value > 0 do
    Repo.query!("SELECT set_config($1, $2, true)", [name, "#{value}ms"])
    {:ok, :configured}
  end
end
