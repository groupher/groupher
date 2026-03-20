import Config

config :groupher_server, GroupherServerWeb.Endpoint,
  server: false,
  load_from_system_env: false

config :groupher_server, GroupherServer.Repo,
  pool_size: String.to_integer(System.get_env("DB_POOL_SIZE") || "5"),
  timeout: String.to_integer(System.get_env("DB_TIMEOUT") || "120000"),
  pool_timeout: String.to_integer(System.get_env("DB_POOL_TIMEOUT") || "30000"),
  queue_target: String.to_integer(System.get_env("DB_QUEUE_TARGET") || "5000"),
  queue_interval: String.to_integer(System.get_env("DB_QUEUE_INTERVAL") || "2000")

config :logger, :console, format: "[$level] $message\n"
