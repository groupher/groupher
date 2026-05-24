defmodule GroupherServerWeb.Controller.Health do
  @moduledoc """
  Minimal health-check controller for uptime probes.

  This endpoint is used by infrastructure and deployment checks to confirm that
  the web node is reachable and able to serve requests.
  """
  use GroupherServerWeb, :controller

  @doc """
  Returns a plain-text `"ok"` response for health probing.
  """
  def show(conn, _params) do
    text(conn, "ok")
  end
end
