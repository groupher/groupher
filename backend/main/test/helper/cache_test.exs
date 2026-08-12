defmodule GroupherServer.Test.Helper.Cache do
  @moduledoc false

  use GroupherServerWeb.ConnCase, async: true
  alias Helper.Cache

  @pool :common

  describe "[cache test]" do
    test "cache get un-exist key should get nil" do
      assert {:error, nil} = Cache.get(@pool, "no exist")
      assert {:error, nil} = Cache.get(@pool, :no_exist)
    end

    test "cache put should work" do
      assert {:error, nil} = Cache.get(@pool, :data)

      assert {:ok, true} = Cache.put(@pool, :data, "value")
      assert {:ok, "value"} = Cache.get(@pool, :data)

      # can override
      assert {:ok, true} = Cache.put(@pool, :data, :value)
      assert {:ok, :value} = Cache.get(@pool, :data)

      # complex data
      assert {:ok, true} = Cache.put(@pool, "namespace.aaa.bbb", [1, %{a: "2"}])
      assert {:ok, [1, %{a: "2"}]} = Cache.get(@pool, "namespace.aaa.bbb")
    end

    test "cache can be clear" do
      assert {:ok, true} = Cache.put(@pool, :data, "value")
      assert {:ok, "value"} = Cache.get(@pool, :data)

      assert {:ok, _} = Cache.clear(@pool)
      assert {:error, nil} = Cache.get(@pool, :data)
    end

    test "cache can delete one key" do
      assert {:ok, true} = Cache.put(@pool, :data, "value")
      assert {:ok, "value"} = Cache.get(@pool, :data)

      assert {:ok, _} = Cache.delete(@pool, :data)
      assert {:error, nil} = Cache.get(@pool, :data)
    end

    test "cache expire should work" do
      assert {:ok, true} = Cache.put(@pool, :data, "value", expire_sec: 1)
      assert {:ok, "value"} = Cache.get(@pool, :data)
      Process.sleep(800)
      assert {:ok, "value"} = Cache.get(@pool, :data)
      Process.sleep(500)
      assert {:error, nil} = Cache.get(@pool, :data)
    end

    test "get_or_fetch caches successful loader results" do
      key = "get-or-fetch-success-#{System.unique_integer([:positive])}"

      assert {:ok, 42} =
               Cache.get_or_fetch(@pool, key, [expire_sec: 30], fn ->
                 {:ok, 42}
               end)

      assert {:ok, 42} =
               Cache.get_or_fetch(@pool, key, [expire_sec: 30], fn ->
                 flunk("cached loader should not run")
               end)
    end

    test "get_or_fetch does not cache loader errors" do
      key = "get-or-fetch-error-#{System.unique_integer([:positive])}"

      assert {:error, :upstream_unavailable} =
               Cache.get_or_fetch(@pool, key, [expire_sec: 30], fn ->
                 {:error, :upstream_unavailable}
               end)

      assert {:ok, 7} =
               Cache.get_or_fetch(@pool, key, [expire_sec: 30], fn ->
                 {:ok, 7}
               end)
    end

    test "get_or_fetch supports empty options" do
      key = "get-or-fetch-default-options-#{System.unique_integer([:positive])}"

      assert {:ok, 42} = Cache.get_or_fetch(@pool, key, [], fn -> {:ok, 42} end)
      assert {:ok, 42} = Cache.get(@pool, key)
    end

    test "get_or_fetch converts loader exceptions to errors without caching" do
      key = "get-or-fetch-exception-#{System.unique_integer([:positive])}"

      assert {:error, {:exception, "loader failed"}} =
               Cache.get_or_fetch(@pool, key, [expire_sec: 30], fn ->
                 raise "loader failed"
               end)

      assert {:ok, 42} =
               Cache.get_or_fetch(@pool, key, [expire_sec: 30], fn ->
                 {:ok, 42}
               end)
    end

    test "get_or_fetch single-flights concurrent cache misses" do
      key = "get-or-fetch-concurrent-#{System.unique_integer([:positive])}"
      parent = self()

      results =
        1..8
        |> Task.async_stream(
          fn _ ->
            Cache.get_or_fetch(@pool, key, [expire_sec: 30], fn ->
              send(parent, :loader_called)
              Process.sleep(50)
              {:ok, 99}
            end)
          end,
          max_concurrency: 8,
          timeout: 1_000
        )
        |> Enum.map(fn {:ok, result} -> result end)

      assert results == List.duplicate({:ok, 99}, 8)
      assert_received :loader_called
      refute_received :loader_called
    end
  end
end
