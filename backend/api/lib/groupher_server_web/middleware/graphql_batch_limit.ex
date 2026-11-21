defmodule GroupherServerWeb.Middleware.GraphQLBatchLimit do
  @moduledoc """
  Bounds the number of GraphQL operations in a transport batch.

  Business position:

      Parsed request -> batch admission -> CSRF and Absinthe
  """

  import Plug.Conn
  @behaviour Plug
  @max_batch 10

  def init(opts), do: opts

  def call(conn, _) do
    conn = fetch_query_params(conn)
    params = conn.params
    batch = decode_batch(params["_json"] || params["operations"])

    if is_list(batch) and length(batch) > @max_batch do
      body = Jason.encode!(%{errors: [%{message: "GraphQL batch limit exceeded"}]})
      conn |> put_resp_content_type("application/json") |> send_resp(413, body) |> halt()
    else
      conn
    end
  end

  defp decode_batch(value) when is_binary(value) do
    case Jason.decode(value) do
      {:ok, decoded} -> decoded
      _ -> nil
    end
  end

  defp decode_batch(value), do: value
end
