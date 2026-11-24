defmodule GroupherServerWeb.ContextBrowserSessionTest do
  use GroupherServer.TestMate, async: false
  import Plug.Conn
  import Plug.Test
  alias GroupherServer.{Accounts, Auth}
  alias Accounts.Profiles.BrowserSessions
  alias Auth.Contract, as: AuthContract
  alias GroupherServerWeb.Context
  alias Helper.Guardian.BrowserAccess

  test "ordinary cookies stop authenticating immediately after their Session is revoked" do
    {:ok, user} = db_insert(:user)
    {:ok, session} = BrowserSessions.create(user)
    assert cookie_context(session.access_token).cur_user.id == user.id
    assert {:ok, :revoked} = BrowserSessions.revoke_current(session.browser_session_ref)
    context = cookie_context(session.access_token)
    assert context.auth_failure == AuthContract.session_revoked()
    refute Map.has_key?(context, :cur_user)
  end

  test "a valid JWT with a missing Session does not authenticate an ordinary browser" do
    {:ok, user} = db_insert(:user)

    {:ok, token, _} =
      BrowserAccess.encode(user, "bs_missing", DateTime.add(DateTime.utc_now(:second), 3600))

    assert cookie_context(token).auth_failure == AuthContract.session_revoked()
  end

  defp cookie_context(token) do
    :get
    |> conn("/graphiql")
    |> put_req_header("cookie", "groupher-auth.token=#{token}")
    |> fetch_cookies()
    |> Context.build_context()
  end
end
