defmodule GroupherServer.CMS.ViewTracker.RateLimit do
  @moduledoc """
  Lightweight per-instance admission guard for the public tracking endpoint.

  Product dedupe remains the source of view semantics; this guard only limits
  anonymous write amplification before an event is persisted.

      trackArticleView request
        -> RateLimit per viewer/minute
        -> ViewTracker event admission
  """

  @table :groupher_view_tracker_rate_limit
  @window_seconds 60
  @max_requests 120

  use GenServer

  @doc false
  def start_link(_opts), do: GenServer.start_link(__MODULE__, :ok, name: __MODULE__)

  @impl GenServer
  def init(:ok) do
    :ets.new(@table, [:named_table, :public, :set, read_concurrency: true])
    schedule_cleanup()
    {:ok, %{}}
  end

  @impl GenServer
  def handle_info(:cleanup, state) do
    bucket = div(System.system_time(:second), @window_seconds)

    @table
    |> :ets.tab2list()
    |> Enum.each(fn
      {{key, row_bucket}, _count} when row_bucket < bucket - 1 ->
        :ets.delete(@table, {key, row_bucket})

      _ ->
        :ok
    end)

    schedule_cleanup()
    {:noreply, state}
  end

  @doc "Allows a bounded number of tracking requests per viewer per minute."
  @spec allow?(term()) :: boolean()
  def allow?(key) do
    case :ets.whereis(@table) do
      :undefined -> false
      _table -> allow_in_current_bucket(key)
    end
  rescue
    ArgumentError -> false
  end

  defp allow_in_current_bucket(key) do
    bucket = div(System.system_time(:second), @window_seconds)
    counter_key = {key, bucket}
    count = :ets.update_counter(@table, counter_key, {2, 1}, {counter_key, 0})
    :ets.delete(@table, {key, bucket - 1})
    count <= @max_requests
  end

  defp schedule_cleanup, do: Process.send_after(self(), :cleanup, @window_seconds * 1_000)
end
