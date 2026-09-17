defmodule GroupherServer.ServiceAuth.Cache do
  @moduledoc """
  Owns the long-lived ETS tables used by service-auth token and JWKS caches.

      Application Supervisor
        -> ServiceAuth.Cache
        -> token/JWKS ETS tables
        -> Client and Verifier
  """

  use GenServer

  @tables [:groupher_service_token_cache, :groupher_service_auth_jwks]

  def start_link(_opts), do: GenServer.start_link(__MODULE__, :ok, name: __MODULE__)

  @impl GenServer
  def init(:ok) do
    Enum.each(@tables, fn table ->
      :ets.new(table, [:named_table, :public, read_concurrency: true])
    end)

    {:ok, %{}}
  end
end
