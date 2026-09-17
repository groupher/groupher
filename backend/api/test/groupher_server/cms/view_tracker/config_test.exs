defmodule GroupherServer.Test.CMS.ViewTracker.ConfigTest do
  use ExUnit.Case, async: false

  alias GroupherServer.CMS.ViewTracker.Config

  setup do
    original = Application.get_env(:groupher_server, Config)

    on_exit(fn ->
      if is_nil(original),
        do: Application.delete_env(:groupher_server, Config),
        else: Application.put_env(:groupher_server, Config, original)
    end)

    :ok
  end

  test "reads the sliding dedupe window from runtime configuration" do
    Application.put_env(:groupher_server, Config,
      dedupe_window_seconds: 180,
      dedupe_state_retention_days: 1
    )

    assert Config.dedupe_window_seconds() == 180
    assert Config.dedupe_state_retention_days() == 1
  end

  test "rejects dedupe retention that cannot cover the configured window" do
    Application.put_env(:groupher_server, Config,
      dedupe_window_seconds: 86_400,
      dedupe_state_retention_days: 1
    )

    assert_raise ArgumentError, ~r/dedupe_state_retention_days/, fn ->
      Config.dedupe_state_retention_days()
    end
  end
end
