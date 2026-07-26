defmodule GroupherServerWeb.Controller.Health do
  @moduledoc """
  Minimal health-check controller for uptime probes and service contract checks.

  This endpoint is used by infrastructure and deployment checks to confirm that
  the web node is reachable and able to serve requests.
  """
  use GroupherServerWeb, :controller

  @doc """
  Returns the shared health contract response for health probing.
  """
  def show(conn, _params) do
    json(conn, %{
      schemaVersion: "health.v1",
      status: "ok",
      service: "phoenix",
      version: version(),
      environment: environment(),
      timestamp: DateTime.utc_now() |> DateTime.to_iso8601(),
      uptimeMs: uptime_ms(),
      checks: []
    })
  end

  defp version do
    :groupher_server
    |> Application.spec(:vsn)
    |> to_string()
  end

  defp environment do
    :groupher_server
    |> Application.get_env(:env, :dev)
    |> to_string()
  end

  defp uptime_ms do
    :erlang.statistics(:wall_clock)
    |> elem(0)
  end
end
