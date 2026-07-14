defmodule Helper.TestFakes.SearchArtimentsQueue do
  @moduledoc false

  @behaviour GroupherServer.CMS.SearchArtiments.QueueAdapter

  @table :search_artiments_test_queue

  @impl true
  def enqueue(job) do
    :ets.insert(ensure_table(), {System.unique_integer([:positive, :monotonic]), job})
    {:ok, :pass}
  end

  def jobs do
    ensure_table()
    |> :ets.tab2list()
    |> Enum.sort_by(&elem(&1, 0))
    |> Enum.map(&elem(&1, 1))
  end

  def drain do
    jobs = jobs()
    reset()
    Enum.map(jobs, fn {module, function, args} -> apply(module, function, args) end)
  end

  def reset do
    case :ets.whereis(@table) do
      :undefined -> :ok
      table -> :ets.delete_all_objects(table)
    end
  end

  defp ensure_table do
    case :ets.whereis(@table) do
      :undefined -> :ets.new(@table, [:named_table, :public, :ordered_set])
      table -> table
    end
  rescue
    ArgumentError -> :ets.whereis(@table)
  end
end
