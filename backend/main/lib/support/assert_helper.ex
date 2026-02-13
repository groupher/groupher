defmodule GroupherServer.Test.AssertHelper do
  @moduledoc """
  This module defines some helper function used by
  tests that require check from graphql response

  NOTE: we use POST in query_get, see https://github.com/coderplanets/coderplanets_server/issues/259
  """

  import Helper.ErrorCode, only: [ecode: 1]
  import Phoenix.ConnTest
  import Helper.Utils, only: [map_key_stringify: 1, get_config: 2]

  @endpoint GroupherServerWeb.Endpoint

  @inner_page_size get_config(:general, :inner_page_size)

  @doc """
  used for non exist id
  """
  def non_exist_id, do: 15_982_398_614
  def non_exist_slug, do: "no-exist"
  def non_exist_login, do: "15_982_398_614"
  # def page_size, do: @page_size

  def is_error?(reason, code) when is_atom(code) do
    error_code(reason) == ecode(code)
  end

  def error_code(reason) when is_list(reason), do: Keyword.get(reason, :code)
  def error_code({reason, _meta}) when is_atom(reason), do: ecode(reason)
  def error_code(reason) when is_atom(reason), do: ecode(reason)
  def error_code(_), do: nil

  def assert_v(:inner_page_size), do: @inner_page_size

  def is_valid_kv?(obj, key, :list) when is_map(obj) do
    obj = map_key_stringify(obj)

    case Map.has_key?(obj, key) do
      true -> obj |> Map.get(key) |> is_list
      _ -> false
    end
  end

  def is_valid_kv?(obj, key, :int) when is_map(obj) do
    obj = map_key_stringify(obj)

    case Map.has_key?(obj, key) do
      true -> obj |> Map.get(key) |> is_integer
      _ -> false
    end
  end

  def is_valid_kv?(obj, key, :string) when is_map(obj) and is_binary(key) do
    obj = map_key_stringify(obj)

    case Map.has_key?(obj, key) do
      true -> String.length(Map.get(obj, key)) != 0
      _ -> false
    end
  end

  def is_valid_pagination?(obj) when is_map(obj) do
    is_valid_kv?(obj, "entries", :list) and is_valid_kv?(obj, "totalPages", :int) and
      is_valid_kv?(obj, "totalCount", :int) and is_valid_kv?(obj, "pageSize", :int) and
      is_valid_kv?(obj, "pageNumber", :int)
  end

  def is_valid_pagination?(obj, :empty) when is_map(obj) do
    case is_valid_pagination?(obj) do
      false ->
        false

      true ->
        obj["entries"] |> Enum.empty?() and obj["totalCount"] == 0 and obj["pageNumber"] == 1 and
          obj["totalPages"] == 1
    end
  end

  def is_valid_pagination?(obj, :raw) when is_map(obj) do
    is_valid_kv?(obj, "entries", :list) and is_valid_kv?(obj, "total_pages", :int) and
      is_valid_kv?(obj, "total_count", :int) and is_valid_kv?(obj, "page_size", :int) and
      is_valid_kv?(obj, "page_number", :int)
  end

  def is_valid_pagination?(obj, :raw, :empty) when is_map(obj) do
    case is_valid_pagination?(obj, :raw) do
      false ->
        false

      true ->
        obj.entries |> Enum.empty?() and obj.total_count == 0 and obj.page_number == 1 and
          obj.total_pages == 1
    end
  end

  @doc """
  simulate the Graphiql mutate operation
  """
  def gq_mutation(conn, query, variables, flag \\ false) do
    conn
    |> post("/graphiql", query: query, variables: variables)
    |> json_response(200)
    |> log_debug_info(flag)
    |> Map.get("data")
    |> Map.get(get_operation_name(query))
  end

  def get_operation_name(query) when is_binary(query) do
    # 移除注释和换行，简化处理
    normalized =
      query
      # 移除注释
      |> String.replace(~r/#[^\n]*/, "")
      # 替换换行为空格
      |> String.replace("\n", " ")
      |> String.trim()

    # 更通用的正则表达式，处理多种情况：
    # 1. 有操作类型(query/mutation)和操作名
    # 2. 有操作类型但无操作名
    # 3. 无操作类型(简写语法)
    # 4. 有别名的情况
    regex = ~r/
      (?:query|mutation)\s+
      (?:[a-zA-Z0-9_]+\s*)?
      (?:\([^)]*\)\s*)?
      (?:\:\s*[a-zA-Z0-9_]+\s*)?
      \{\s*
      (?:[a-zA-Z0-9_]+\s*\:\s*)?
      ([a-zA-Z0-9_]+)
      \s*\(?
    /x

    case Regex.run(regex, normalized) do
      [_, operation_name] ->
        operation_name

      _ ->
        # 如果没有匹配到，尝试简写语法(只有 { operation { ... } })
        case Regex.run(~r/\{\s*([a-zA-Z0-9_]+)\s*\(?/, normalized) do
          [_, operation_name] -> operation_name
          _ -> nil
        end
    end
  end

  def gq_query(conn, query, variables, flag \\ false) do
    conn
    |> post("/graphiql", query: query, variables: variables)
    |> json_response(200)
    |> log_debug_info(flag)
    |> Map.get("data")
    |> Map.get(get_operation_name(query))
  end

  def gq_query(conn, query) do
    conn
    |> post("/graphiql", query: query, variables: %{})
    |> json_response(200)
    |> Map.get("data")
    |> Map.get(get_operation_name(query))
  end

  def mutation_error?(conn, query, variables, opt \\ false)

  def mutation_error?(conn, query, variables, code) when is_integer(code) do
    resp = gq_resp(conn, query, variables)
    has_error_code?(resp, code)
  end

  def mutation_error?(conn, query, variables, flag) do
    resp = gq_resp(conn, query, variables) |> log_debug_info(flag)
    has_errors?(resp)
  end

  @doc """
  check if Graphiql query get error
  """
  def query_error?(conn, query, variables, opt \\ false)

  def query_error?(conn, query, variables, code) when is_integer(code) do
    resp = gq_resp(conn, query, variables)
    has_error_code?(resp, code)
  end

  def query_error?(conn, query, variables, flag) do
    resp = gq_resp(conn, query, variables) |> log_debug_info(flag)
    has_errors?(resp)
  end

  defp gq_resp(conn, query, variables) do
    conn
    |> post("/graphiql", query: query, variables: variables)
    |> json_response(200)
  end

  defp has_errors?(resp), do: Map.has_key?(resp, "errors")

  defp has_error_code?(resp, code) when is_integer(code) do
    case resp do
      %{"errors" => [first | _]} -> Map.get(first, "code") == code
      _ -> false
    end
  end

  def firstn_and_last(values, 3) do
    [value_1 | [value_2 | [value_3 | _]]] = values
    value_x = values |> List.last()

    [value_1, value_2, value_3, value_x]
  end

  # log response info if need
  defp log_debug_info(res, :debug) do
    # credo:disable-for-next-line Credo.Check.Warning.IoInspect
    IO.inspect(res, label: "debug")
  end

  defp log_debug_info(res, _), do: res

  @doc "check id is exist in list of Map<id: xxx> structure"
  @spec exist_in?(map(), [map()]) :: boolean
  def exist_in?(%{id: id}, list) when is_list(list) do
    list
    |> Enum.any?(fn item ->
      to_string(id) == to_string(Map.get(item, :id, Map.get(item, "id")))
    end)
  end

  # def user_exist_in?(%{id: id}, list) when is_list(list) do
  #   list |> Enum.any?(&(&1["id"] == to_string(id)))
  # end

  # for embed user situation
  def user_exist_in?(%{login: login}, list) when is_list(list) do
    # list |> Enum.any?(&(&1.login == login or &1["login"] == login))
    list
    |> Enum.any?(fn u ->
      login == Map.get(u, :login, Map.get(u, "login"))
    end)
  end
end
