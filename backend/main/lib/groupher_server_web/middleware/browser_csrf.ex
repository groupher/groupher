defmodule GroupherServerWeb.Middleware.BrowserCsrf do
  @moduledoc """
  Final CSRF boundary for browser-cookie GraphQL mutations.

  Gateway rejects malformed browser requests early, but Phoenix verifies the
  original request metadata again before any GraphQL resolver can run.

  Business position:

      Resolver result
        -> BrowserCsrf middleware
        -> next middleware
        -> GraphQL field result
  """

  import Plug.Conn

  @behaviour Plug

  @production_hosts MapSet.new([
                      "groupher.com",
                      "main.groupher.com",
                      "dashboard.groupher.com",
                      "dash.groupher.com"
                    ])
  @development_hosts MapSet.new([
                       "groupher.localhost",
                       "main.groupher.localhost",
                       "dashboard.groupher.localhost",
                       "dash.groupher.localhost"
                     ])

  def init(options), do: options

  def call(conn, _options) do
    conn = conn |> fetch_cookies() |> fetch_query_params()

    cond do
      not browser_cookie?(conn) or not mutation_request?(conn) ->
        conn

      conn.method != "POST" ->
        reject(conn, 405, "Mutations must use POST.", "INVALID_REQUEST")

      valid_browser_mutation?(conn) ->
        conn

      true ->
        reject(conn, 400, "CSRF proof is required.", "INVALID_CSRF")
    end
  end

  defp browser_cookie?(conn), do: Map.has_key?(conn.req_cookies, "groupher-auth.token")

  defp mutation_request?(%Plug.Conn{method: "GET", query_params: params}),
    do: mutation_params?(params)

  defp mutation_request?(%Plug.Conn{body_params: %Plug.Conn.Unfetched{}}), do: false
  defp mutation_request?(%Plug.Conn{body_params: params}), do: mutation_params?(params)

  defp mutation_params?(params) when is_list(params), do: Enum.any?(params, &mutation_params?/1)

  defp mutation_params?(params) when is_map(params) do
    query = Map.get(params, "query") || Map.get(params, :query)
    operation_name = Map.get(params, "operationName") || Map.get(params, :operation_name)

    is_binary(query) and mutation_operation?(query, operation_name)
  end

  defp mutation_params?(_), do: false

  defp mutation_operation?(query, operation_name) do
    with {:ok, %{input: %Absinthe.Language.Document{definitions: definitions}}} <-
           Absinthe.Phase.Parse.run(query, []) do
      operations =
        Enum.filter(definitions, &match?(%Absinthe.Language.OperationDefinition{}, &1))

      case operation_name do
        name when is_binary(name) and name != "" ->
          Enum.any?(operations, &(&1.name == name and &1.operation == :mutation))

        _ ->
          Enum.any?(operations, &(&1.operation == :mutation))
      end
    else
      _ -> false
    end
  end

  defp valid_browser_mutation?(conn) do
    json_request?(conn) and csrf_header?(conn) and allowed_origin?(get_req_header(conn, "origin"))
  end

  defp json_request?(conn) do
    conn
    |> get_req_header("content-type")
    |> Enum.any?(&String.starts_with?(&1, "application/json"))
  end

  defp csrf_header?(conn), do: get_req_header(conn, "x-groupher-csrf") == ["1"]

  defp allowed_origin?([origin]) do
    with {:ok, uri} <- URI.new(origin),
         true <- uri.scheme in ["http", "https"],
         true <- no_path_or_query?(uri),
         true <- host_allowed?(uri) do
      true
    else
      _ -> false
    end
  end

  defp allowed_origin?(_), do: false

  defp no_path_or_query?(uri),
    do: uri.path in [nil, "/"] and is_nil(uri.query) and is_nil(uri.fragment)

  defp host_allowed?(%URI{scheme: "https", port: port, host: host}) when port in [nil, 443] do
    MapSet.member?(@production_hosts, host) or development_host?(host)
  end

  defp host_allowed?(%URI{scheme: "http", port: port, host: host}) when port in [nil, 80],
    do: development_host?(host)

  defp host_allowed?(_), do: false

  defp development_host?(host) do
    Application.get_env(:groupher_server, :env) != :prod and
      MapSet.member?(@development_hosts, host)
  end

  defp reject(conn, status, message, code) do
    body = Jason.encode!(%{errors: [%{message: message, extensions: %{code: code}}]})

    conn
    |> put_resp_content_type("application/json")
    |> send_resp(status, body)
    |> halt()
  end
end
