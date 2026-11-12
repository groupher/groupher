defmodule GroupherServerWeb.Controller.GraphiQL do
  @moduledoc """
  Serves the separately built GraphiQL developer interface.

  Business position:

      IDE request -> built HTML -> GraphiQL -> GraphQL API
  """
  use GroupherServerWeb, :controller

  def show(conn, _params) do
    path = Application.app_dir(:groupher_server, "priv/static/graphiql/index.html")

    if File.regular?(path) do
      conn
      |> put_resp_header("cache-control", "no-store")
      |> put_resp_content_type("text/html")
      |> send_file(200, path)
    else
      conn
      |> put_resp_content_type("text/plain")
      |> send_resp(503, "GraphiQL assets have not been built.")
    end
  end
end
