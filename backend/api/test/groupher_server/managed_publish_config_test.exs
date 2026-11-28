defmodule GroupherServer.ManagedPublishConfigTest do
  use ExUnit.Case, async: false

  alias GroupherServer.CMS
  alias CMS.Gate.RateLimit.Publish.Config

  test "managed limits apply only to development, never test or production" do
    original_env = Application.get_env(:groupher_server, :env)
    original_limits = Application.fetch_env(:groupher_server, :managed_publish_throttle)

    on_exit(fn ->
      Application.put_env(:groupher_server, :env, original_env)

      case original_limits do
        {:ok, value} -> Application.put_env(:groupher_server, :managed_publish_throttle, value)
        :error -> Application.delete_env(:groupher_server, :managed_publish_throttle)
      end
    end)

    Application.delete_env(:groupher_server, :managed_publish_throttle)
    baseline = Config.publish_throttle()
    managed = [interval_minutes: 0, hour_limit: 1_000, day_limit: 1_000]
    Application.put_env(:groupher_server, :managed_publish_throttle, managed)

    for environment <- [:test, :prod, :seed_prod] do
      Application.put_env(:groupher_server, :env, environment)
      assert Config.publish_throttle() == baseline
    end

    Application.put_env(:groupher_server, :env, :dev)
    assert Config.publish_throttle() == Map.new(managed)
  end
end
