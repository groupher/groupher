defmodule GroupherServer.LocalTestActors.Controller do
  @moduledoc """
  Loopback-only, shared-key development transport for local test fixtures.

      Hub CLI / development Auth -> local checks -> fixture command -> JSON
  """
  use GroupherServerWeb, :controller
  alias GroupherServer.LocalTestActors

  def execute(conn, input) do
    conn = put_resp_header(conn, "cache-control", "no-store")
    secret = System.get_env("LOCAL_TEST_ACTORS_SECRET", "")
    supplied = get_req_header(conn, "x-groupher-local-test") |> List.first()

    allowed =
      conn.remote_ip in [{127, 0, 0, 1}, {0, 0, 0, 0, 0, 0, 0, 1}] and
        conn.host in ["127.0.0.1", "localhost", "api.groupher.localhost"] and
        byte_size(secret) >= 32 and is_binary(supplied) and
        Plug.Crypto.secure_compare(secret, supplied)

    if allowed do
      case LocalTestActors.execute(input) do
        {:ok, result} -> json(conn, %{data: result})
        {:error, reason} -> conn |> put_status(400) |> json(%{error: safe_error(reason)})
      end
    else
      conn |> put_status(403) |> json(%{error: "local_test_access_denied"})
    end
  end

  defp safe_error(reason) when is_atom(reason), do: Atom.to_string(reason)
  defp safe_error(_), do: "local_test_command_failed"
end
