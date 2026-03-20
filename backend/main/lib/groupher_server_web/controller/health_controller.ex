defmodule GroupherServerWeb.Controller.Health do
  use GroupherServerWeb, :controller

  def show(conn, _params) do
    text(conn, "ok")
  end
end
