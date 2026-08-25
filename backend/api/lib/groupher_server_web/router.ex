defmodule GroupherServerWeb.Router do
  @moduledoc """
  Phoenix router for server-rendered health, OG, and GraphQL tooling endpoints.

      /
      /health
      /api/og-info
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

  scope "/api" do
    pipe_through(:api)

    # get "/og-info", TodoController, only: [:index]
    # resources("/og-info", OG, only: [:index])
    get("/og-info", GroupherServerWeb.Controller.OG, :index)
  end

  scope "/graphiql" do
    pipe_through(:api)

    forward(
      "/",
      Absinthe.Plug.GraphiQL,
      schema: GroupherServerWeb.Schema,
      # json_codec: Jason,
      interface: :playground
      # context: %{pubsub: GroupherServerWeb.Endpoint}
    )
  end
end
