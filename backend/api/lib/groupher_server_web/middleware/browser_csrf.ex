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

  alias Absinthe.Phase.Parse
  import Plug.Conn

  @behaviour Plug

  @production_hosts MapSet.new([
                      "groupher.com",
                      "dash.groupher.com",
                      "api.groupher.com"
                    ])
  @development_hosts MapSet.new([
                       "groupher.localhost",
                       "community.groupher.localhost",
                       "dash.groupher.localhost",
                       "api.groupher.localhost"
                     ])
  @development_http_ports %{
    "groupher.localhost" => MapSet.new([nil, 80]),
    "community.groupher.localhost" => MapSet.new([nil, 80, 3107]),
    "dash.groupher.localhost" => MapSet.new([nil, 80, 3103]),
    "api.groupher.localhost" => MapSet.new([nil, 80, 4001])
  }

  def init(options), do: options

  def call(conn, _options) do
    conn = conn |> fetch_cookies() |> fetch_query_params()

    cond do
      not browser_cookie?(conn) ->
        conn

      conn.method not in ["GET", "HEAD"] and not json_request?(conn) ->
        reject(conn, 400, "JSON is required.", GroupherServer.Auth.contract_invalid_csrf())

      not mutation_request?(conn) ->
        conn

      conn.method != "POST" ->
        reject(
          conn,
          405,
          "Mutations must use POST.",
          GroupherServer.Auth.contract_invalid_request()
        )

      valid_browser_mutation?(conn) ->
        conn

      true ->
        reject(conn, 400, "CSRF proof is required.", GroupherServer.Auth.contract_invalid_csrf())
    end
  end

  defp browser_cookie?(conn), do: Map.has_key?(conn.req_cookies, "groupher-auth.token")

  defp mutation_request?(%Plug.Conn{params: params, body_params: body_params}) do
    mutation_params?(params) or mutation_params?(body_params)
  end

  defp mutation_params?(params) when is_list(params), do: Enum.any?(params, &mutation_params?/1)

  defp mutation_params?(params) when is_map(params) do
    query = Map.get(params, "query") || Map.get(params, :query)
    operation_name = Map.get(params, "operationName") || Map.get(params, :operation_name)

    (is_binary(query) and mutation_operation?(query, operation_name)) or
      nested_mutation?(Map.get(params, "_json")) or
      nested_mutation?(Map.get(params, "operations"))
  end

  defp mutation_params?(_), do: false

  defp nested_mutation?(value) when is_binary(value) do
    case Jason.decode(value) do
      {:ok, decoded} -> mutation_params?(decoded)
      _ -> false
    end
  end

  defp nested_mutation?(value), do: mutation_params?(value)

  defp mutation_operation?(query, operation_name) do
    case Parse.run(query, token_limit: GroupherServerWeb.GraphQLLimits.token_limit()) do
      {:ok, %{input: %Absinthe.Language.Document{definitions: definitions}}} ->
        operations =
          Enum.filter(definitions, &match?(%Absinthe.Language.OperationDefinition{}, &1))

        case operation_name do
          name when is_binary(name) and name != "" ->
            Enum.any?(operations, &(&1.name == name and &1.operation == :mutation))

          _ ->
            Enum.any?(operations, &(&1.operation == :mutation))
        end

      _ ->
        false
    end
  end

  defp valid_browser_mutation?(conn) do
    json_request?(conn) and csrf_header?(conn) and allowed_origin?(get_req_header(conn, "origin"))
  end

  defp json_request?(conn) do
    conn
    |> get_req_header("content-type")
    |> Enum.any?(fn content_type ->
      case Plug.Conn.Utils.media_type(content_type) do
        {:ok, "application", "json", _params} -> true
        _ -> false
      end
    end)
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

  defp no_path_or_query?(uri) do
    uri.path in [nil, "/"] and is_nil(uri.query) and is_nil(uri.fragment)
  end

  defp host_allowed?(%URI{scheme: "https", port: port, host: host}) when port in [nil, 443] do
    MapSet.member?(@production_hosts, host) or development_host?(host)
  end

  defp host_allowed?(%URI{scheme: "http", port: port, host: host}) do
    development_host?(host) and
      MapSet.member?(Map.get(@development_http_ports, host, MapSet.new()), port)
  end

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
