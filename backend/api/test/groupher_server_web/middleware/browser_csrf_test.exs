defmodule GroupherServerWeb.Middleware.BrowserCsrfTest do
  use ExUnit.Case, async: true

  import Plug.Conn
  import Plug.Test

  alias GroupherServerWeb.Middleware.BrowserCsrf

  test "allows authenticated background queries without browser CSRF proof" do
    conn = request(:post, %{"query" => "query Viewer { me { id } }"})

    refute conn.halted
  end

  test "rejects an authenticated mutation without browser CSRF proof" do
    conn = request(:post, %{"query" => "mutation Update { updateProfile(profile: {}) { id } }"})

    assert conn.halted
    assert conn.status == 400

    assert Jason.decode!(conn.resp_body)["errors"] |> hd() |> get_in(["extensions", "code"]) ==
             "INVALID_CSRF"
  end

  test "allows an authenticated mutation with an allowed local origin and CSRF proof" do
    conn =
      request(:post, %{"query" => "mutation Update { updateProfile(profile: {}) { id } }"}, [
        {"content-type", "application/json"},
        {"origin", "https://dash.groupher.localhost"},
        {"x-groupher-csrf", "1"}
      ])

    refute conn.halted
  end

  test "uses operationName when a document contains multiple operations" do
    query = "query Viewer { me { id } } mutation Update { updateProfile(profile: {}) { id } }"
    conn = request(:post, %{"query" => query, "operationName" => "Viewer"})

    refute conn.halted
  end

  test "rejects mutations sent over GET" do
    conn =
      conn(
        :get,
        "/graphiql?query=mutation%20Update%20%7B%20updateProfile(profile%3A%20%7B%7D)%20%7B%20id%20%7D%20%7D"
      )
      |> put_req_cookie("groupher-auth.token", "token")
      |> BrowserCsrf.call([])

    assert conn.halted
    assert conn.status == 405
  end

  defp request(method, params, headers \\ []) do
    conn(method, "/graphiql")
    |> put_req_cookie("groupher-auth.token", "token")
    |> Map.put(:body_params, params)
    |> then(fn conn ->
      Enum.reduce(headers, conn, &put_req_header(&2, elem(&1, 0), elem(&1, 1)))
    end)
    |> BrowserCsrf.call([])
  end
end
