defmodule GroupherServer.Test.CMS.ViewTracker.ConfigTest do
  use ExUnit.Case, async: false

  alias GroupherServer.CMS
  alias CMS.ViewTracker.Config

  setup do
    original = Application.get_env(:groupher_server, Config)

    on_exit(fn ->
      if is_nil(original) do
        Application.delete_env(:groupher_server, Config)
      else
        Application.put_env(:groupher_server, Config, original)
      end
    end)

    :ok
  end

  test "reads actor windows and cleanup budgets from runtime configuration" do
    Application.put_env(:groupher_server, Config,
      human_dedupe_window_seconds: 180,
      agent_dedupe_window_seconds: 300,
      cleanup_safety_margin_seconds: 86_400,
      cleanup_batch_size: 250,
      cleanup_row_budget: 2_500,
      cleanup_time_budget_ms: 12_000
    )

    assert Config.dedupe_window_seconds(:human) == 180
    assert Config.dedupe_window_seconds(:agent) == 300
    assert Config.cleanup_safety_margin_seconds() == 86_400
    assert Config.dedupe_state_ttl_seconds(:human) == 86_580
    assert Config.cleanup_batch_size() == 250
    assert Config.cleanup_row_budget() == 2_500
    assert Config.cleanup_time_budget_ms() == 12_000
  end

  test "rejects invalid cleanup budgets" do
    Application.put_env(:groupher_server, Config, cleanup_row_budget: 0)

    assert_raise ArgumentError, ~r/cleanup_row_budget/, fn ->
      Config.cleanup_row_budget()
    end
  end
end
