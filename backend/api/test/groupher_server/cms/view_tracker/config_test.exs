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

  test "reads actor-specific windows and retention from runtime configuration" do
    Application.put_env(:groupher_server, Config,
      human_dedupe_window_seconds: 180,
      agent_dedupe_window_seconds: 300,
      view_count_receipt_ttl_seconds: 960,
      watermark_retention_seconds: 86_400,
      retention_batch_size: 250
    )

    assert Config.dedupe_window_seconds(:human) == 180
    assert Config.dedupe_window_seconds(:agent) == 300
    assert Config.view_count_receipt_ttl_seconds() == 960
    assert Config.watermark_retention_seconds() == 86_400
    assert Config.retention_batch_size() == 250
  end

  test "rejects watermark retention that cannot cover every actor window" do
    Application.put_env(:groupher_server, Config,
      human_dedupe_window_seconds: 600,
      agent_dedupe_window_seconds: 86_400,
      watermark_retention_seconds: 86_400
    )

    assert_raise ArgumentError, ~r/watermark_retention_seconds/, fn ->
      Config.watermark_retention_seconds()
    end
  end
end
