defmodule GroupherServer.Logs do
  @moduledoc """
  Namespace boundary for persisted platform activity logs.

  The context currently exposes no public operations; schemas remain grouped
  here so future audit reads and writes do not leak through unrelated domains.

  Business position:

      Application caller
        -> Logs
        -> domain / infrastructure boundary
  """

  # import Ecto.Query, warn: false
  # alias GroupherServer.Repo

  # alias GroupherServer.Logs.UserActivity
end
