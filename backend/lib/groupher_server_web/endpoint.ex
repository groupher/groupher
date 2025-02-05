defmodule GroupherServerWeb.Endpoint do
  # use Sentry.PlugCapture
  use Phoenix.Endpoint, otp_app: :groupher_server

  # The session will be stored in the cookie and signed,
  # this means its contents can be read but not tampered with.
  # Set :encryption_salt if you would also like to encrypt it.
  @session_options [
    store: :cookie,
    key: "_groupher_server_key",
    signing_salt: "skbsUB/7",
    same_site: "Lax"
  ]

  socket("/live", Phoenix.LiveView.Socket,
    websocket: [connect_info: [session: @session_options]],
    longpoll: [connect_info: [session: @session_options]]
  )

  # socket("/socket", GroupherServerWeb.UserSocket)

  plug(Plug.RequestId)
  plug(Plug.Logger)

  # Serve at "/" the static files from "priv/static" directory.
  #
  # You should set gzip to true if you are running phx.digest
  # when deploying your static files in production.
  plug(Plug.Static,
    at: "/",
    from: :groupher_server,
    gzip: false,
    only: GroupherServerWeb.static_paths()
  )

  # Code reloading can be explicitly enabled under the
  # :code_reloader configuration of your endpoint.
  if code_reloading? do
    # socket("/phoenix/live_reload/socket", Phoenix.LiveReloader.Socket)
    # plug(Phoenix.LiveReloader)
    plug(Phoenix.CodeReloader)
  end

  plug(
    Plug.Parsers,
    parsers: [:urlencoded, :multipart, :json],
    pass: ["*/*"],
    json_decoder: Jason
  )

  plug(Plug.RequestId)

  # plug(Sentry.PlugContext)
  plug(Plug.MethodOverride)
  plug(Plug.Head)
  plug(Plug.Session, @session_options)

  # plug(:inspect_conn)

  plug(
    Corsica,
    # log: [rejected: :error],
    log: [rejected: :debug],
    origins: [
      "http://localhost:3000",
      ~r{^https://(.*\.?)groupher\.com$}
    ],
    # origins: "*",
    allow_headers: [
      "authorization",
      "content-type",
      "special",
      "accept",
      "origin",
      "x-requested-with"
    ],
    allow_credentials: true,
    max_age: 600
  )

  plug(GroupherServerWeb.Router)

  @doc """
  Callback invoked for dynamically configuring the endpoint.

  It receives the endpoint configuration and checks if
  configuration should be loaded from the system environment.
  """
  # def init(_key, config) do
  #   if config[:load_from_system_env] do
  #     {:ok,
  #      Keyword.put(config, :http, [:inet6, ip: {0, 0, 0, 0}, port: System.get_env("PORT") || 8080])}
  #   else
  #     {:ok, config}
  #   end
  # end
end
