defmodule GroupherServer.CMS.ContentImport.AssetStager.RunnerTest do
  use ExUnit.Case, async: true

  alias GroupherServer.CMS.ContentImport.AssetStager.Runner
  alias GroupherServer.CMS.ContentImport.Diagnostic
  alias GroupherServer.CMS.ContentImport.Plan.Asset

  defmodule TrackingStager do
    @behaviour GroupherServer.CMS.ContentImport.AssetStager

    @impl true
    def stage(asset, %{tracker: tracker}, _opts) do
      Agent.update(tracker, fn state ->
        current = state.current + 1
        %{state | current: current, max: max(state.max, current)}
      end)

      Process.sleep(15)
      Agent.update(tracker, &%{&1 | current: &1.current - 1})

      Asset.transition(asset, :ready, %{
        content_hash: String.duplicate("a", 64),
        staging_ref: "staging://#{asset.asset_key}"
      })
    end
  end

  defmodule FlakyStager do
    @behaviour GroupherServer.CMS.ContentImport.AssetStager

    @impl true
    def stage(asset, %{attempts: attempts}, _opts) do
      attempt = Agent.get_and_update(attempts, fn count -> {count + 1, count + 1} end)

      if attempt == 1 do
        Diagnostic.error_result("temporary_asset_failure", "try again")
      else
        Asset.transition(asset, :ready, %{
          content_hash: String.duplicate("b", 64),
          staging_ref: "staging://#{asset.asset_key}"
        })
      end
    end
  end

  defmodule SlowStager do
    @behaviour GroupherServer.CMS.ContentImport.AssetStager

    @impl true
    def stage(asset, _context, _opts) do
      Process.sleep(50)
      Asset.transition(asset, :failed)
    end
  end

  test "limits both batch size and per-Job concurrency" do
    {:ok, tracker} = Agent.start_link(fn -> %{current: 0, max: 0} end)
    assets = Enum.map(1..9, &asset/1)

    assert {:ok, result} =
             Runner.run_batch(assets, TrackingStager, %{job_ref: "job:1", tracker: tracker},
               batch_size: 5,
               max_concurrency: 2,
               timeout: 1_000
             )

    assert result.processed == 5
    assert result.remaining == 4
    assert Enum.count(result.assets, &(&1.status == :ready)) == 5
    assert Agent.get(tracker, & &1.max) <= 2
  end

  test "retries failed work without re-planning the Job" do
    {:ok, attempts} = Agent.start_link(fn -> 0 end)

    assert {:ok, result} =
             Runner.run_batch([asset(1)], FlakyStager, %{job_ref: "job:1", attempts: attempts},
               max_attempts: 2,
               retry_backoff: 1,
               sleeper: fn _milliseconds -> :ok end
             )

    assert [staged] = result.assets
    assert staged.status == :ready
    assert Agent.get(attempts, & &1) == 2
    assert Enum.any?(result.diagnostics, &(&1.code == "temporary_asset_failure"))
  end

  test "turns a timed-out task into an independently failed asset" do
    assert {:ok, result} =
             Runner.run_batch([asset(1)], SlowStager, %{job_ref: "job:1"},
               timeout: 1,
               max_attempts: 1
             )

    assert [failed] = result.assets
    assert failed.status == :failed
    assert Enum.any?(result.diagnostics, &(&1.code == "asset_staging_timeout"))
  end

  defp asset(index) do
    Asset.new!(%{
      asset_key: "asset_#{index}",
      source: {:remote_url, "https://cdn.example.com/#{index}.png"}
    })
  end
end
