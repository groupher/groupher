defmodule GroupherServer.PublicCache.Telemetry do
  @moduledoc """
  Connects PublicCache telemetry to the production structured-log sink.

  The event remains a normal `:telemetry` event for future metrics adapters; the
  built-in sink keeps purge result, invalidation type and safe error code
  observable even when no external metrics exporter is installed.

  Business position:

      PublicCache purge event -> Telemetry handler -> structured production log
  """

  use GenServer

  require Logger

  @event_name "groupher-public-cache-purge"
  @events [[:groupher, :public_cache, :purge]]

  @doc "Starts the one process that owns the PublicCache telemetry handler."
  def start_link(_opts), do: GenServer.start_link(__MODULE__, :ok, name: __MODULE__)

  @impl GenServer
  def init(:ok) do
    :telemetry.attach_many(@event_name, @events, &__MODULE__.handle_event/4, nil)
    {:ok, nil}
  end

  @doc false
  def handle_event(_event, measurements, metadata, _config) do
    Logger.info("public cache purge",
      public_cache: %{measurements: measurements, metadata: metadata}
    )
  end

  @impl GenServer
  def terminate(_reason, _state) do
    :telemetry.detach(@event_name)
    {:ok, :pass}
  end
end
