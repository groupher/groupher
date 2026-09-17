defmodule GroupherServer.Test.CMS.ViewTracker.RateLimitTest do
  use ExUnit.Case, async: false

  alias GroupherServer.CMS.ViewTracker.RateLimit

  test "keeps its ETS table across caller processes and limits one minute bucket" do
    key = {:test, System.unique_integer([:positive])}

    results =
      1..121
      |> Task.async_stream(fn _ -> RateLimit.allow?(key) end, max_concurrency: 16)
      |> Enum.map(fn {:ok, allowed} -> allowed end)

    assert Enum.count(results, & &1) == 120
    assert List.last(results) == false
    assert :ets.whereis(:groupher_view_tracker_rate_limit) != :undefined
  end
end
