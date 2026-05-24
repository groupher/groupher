defmodule GroupherServerWeb.PageController do
  @moduledoc """
  Controller for static site pages rendered by Phoenix.

  It currently serves the default home page and acts as the HTTP entry for basic
  server-rendered view content.
  """
  use GroupherServerWeb, :controller

  @doc """
  Renders the home page without the default application layout.
  """
  def home(conn, _params) do
    # The home page is often custom made,
    # so skip the default app layout.
    render(conn, :home, layout: false)
  end
end
