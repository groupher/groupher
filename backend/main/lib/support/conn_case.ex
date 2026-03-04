defmodule GroupherServerWeb.ConnCase do
  @moduledoc """
  This module defines the test case to be used by
  tests that require setting up a connection.

  Such tests rely on `Phoenix.ConnTest` and also
  import other functionality to make it easier
  to build common datastructures and query the data layer.

  DB tests can run async by passing `async: true` when using this case.
  Each test runs in a SQL sandbox owner process; async tests get isolated
  owners while sync tests run in shared mode.
  """

  use ExUnit.CaseTemplate

  using do
    quote do
      use GroupherServerWeb, :verified_routes

      # Import conveniences for testing with connections
      import Plug.Conn
      import Phoenix.ConnTest
      # import GroupherServerWeb.Router.Helpers
      import GroupherServerWeb.ConnCase

      # The default endpoint for testing
      @endpoint GroupherServerWeb.Endpoint
    end
  end

  setup tags do
    async? = tags[:async] == true

    owner =
      Ecto.Adapters.SQL.Sandbox.start_owner!(GroupherServer.Repo,
        shared: not async?,
        ownership_timeout: 300_000
      )

    on_exit(fn -> Ecto.Adapters.SQL.Sandbox.stop_owner(owner) end)

    {:ok, conn: Phoenix.ConnTest.build_conn()}
  end
end
