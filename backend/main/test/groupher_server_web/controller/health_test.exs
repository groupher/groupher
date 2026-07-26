defmodule GroupherServerWeb.Test.Controller.Health do
  @moduledoc false

  use GroupherServer.TestMate

  test "returns the shared health contract response" do
    conn = build_conn()

    res =
      conn
      |> get("/health")
      |> json_response(200)

    assert res["schemaVersion"] == "health.v1"
    assert res["status"] == "ok"
    assert res["service"] == "phoenix"
    assert is_binary(res["version"])
    assert is_binary(res["environment"])
    assert is_binary(res["timestamp"])
    assert is_integer(res["uptimeMs"])
    assert res["checks"] == []
  end
end
