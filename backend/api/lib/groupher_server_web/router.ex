defmodule GroupherServerWeb.Router do
  @moduledoc """
  Phoenix router for server-rendered health, OG, and GraphQL tooling endpoints.

      /
      /health
      /api/og-info
      /graphql
      /graphiql

  Frontend application routes are owned by the Next.js and TanStack Start apps;
  this router keeps only backend HTTP surfaces that Phoenix serves directly.

  Business position:

      HTTP client
        -> Phoenix Endpoint
        -> Router pipeline
        -> page / health / OG / Absinthe GraphQL
  """

  use GroupherServerWeb, :router

  pipeline :browser do
    plug(:accepts, ["html"])
    plug(:fetch_session)
    plug(:fetch_live_flash)
    plug(:put_root_layout, html: {GroupherServerWeb.Layouts, :root})
    plug(:protect_from_forgery)
    plug(:put_secure_browser_headers)
  end

  scope "/", GroupherServerWeb do
    pipe_through(:browser)

    get("/", PageController, :home)
  end

  scope "/" do
    get("/health", GroupherServerWeb.Controller.Health, :show)
  end

  pipeline :api do
    plug(:accepts, ["json"])
    plug(GroupherServerWeb.Middleware.BrowserCsrf)
    plug(GroupherServerWeb.Context)
  end

  pipeline :graphql_guard do
    plug(GroupherServerWeb.Middleware.GraphQLBatchLimit)
  end

  pipeline :graph_no_store do
    plug(:no_store)
  end

  defp no_store(conn, _opts), do: Plug.Conn.put_resp_header(conn, "cache-control", "no-store")

  scope "/api" do
    pipe_through(:api)

    # get "/og-info", TodoController, only: [:index]
    # resources("/og-info", OG, only: [:index])
    get("/og-info", GroupherServerWeb.Controller.OG, :index)
  end

  scope "/" do
    pipe_through(:graph_no_store)

    get("/graphiql", GroupherServerWeb.Controller.GraphiQL, :show)
  end

  scope "/graphql" do
    pipe_through([:graph_no_store, :graphql_guard, :api])

    forward(
      "/",
      Absinthe.Plug,
      schema: GroupherServerWeb.Schema,
      pipeline: {GroupherServerWeb.GraphQLCost, :pipeline},
      token_limit: GroupherServerWeb.GraphQLLimits.token_limit(),
      analyze_complexity: true,
      max_complexity: GroupherServerWeb.GraphQLLimits.max_complexity()
    )
  end
end
