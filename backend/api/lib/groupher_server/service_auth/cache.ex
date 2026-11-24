defmodule GroupherServer.ServiceAuth.Cache do
  @moduledoc """
  Owns the long-lived ETS tables used by service-auth token and JWKS caches.

      Application Supervisor
        -> ServiceAuth.Cache
        -> public named ETS tables with read concurrency
        -> ServiceAuth.Client token cache / service-token JWKS verifier cache

  The tables are created once at application startup and remain owned by this
  GenServer for the lifetime of the application. Cache entries are managed by
  their consumers; this process establishes the shared storage boundary.
  """

  use GenServer

  @tables [:groupher_service_token_cache, :groupher_service_auth_jwks]

  @doc "Starts the process that owns the shared service-auth ETS tables."
  def start_link(_opts), do: GenServer.start_link(__MODULE__, :ok, name: __MODULE__)

  @impl GenServer
  @doc "Creates the named token and JWKS ETS tables during application startup."
  def init(:ok) do
    Enum.each(@tables, fn table ->
      :ets.new(table, [:named_table, :public, read_concurrency: true])
    end)

    {:ok, %{}}
  end
end
