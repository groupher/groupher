defmodule GroupherServer.Analysis.Provider.Umami do
  @moduledoc """
  Umami adapter for Groupher Web Analysis.

  v1 uses one global Umami website and derives community isolation from URL
  paths. Since Umami path filters are exact-value filters, this adapter queries
  path metrics and applies prefix filtering before returning the Dashboard DTO.
  """

  @behaviour GroupherServer.Analysis.Provider

  use Tesla

  alias GroupherServer.Analysis.Community

  @default_limit 500
  @idempotent_retry_delay 200
  @idempotent_retry_count 2
  @origin "https://analysis.groupher.com"

  plug(Tesla.Middleware.JSON, engine: Jason)

  @impl true
  def summary(config, %Community{} = community, range) do
    with {:ok, request} <- request_config(config),
         {:ok, rows} <- path_metrics(request, range) do
      {:ok, aggregate_path_metrics(rows, community.path_prefix)}
    end
  end

  @spec aggregate_path_metrics(list(), String.t()) :: map()
  def aggregate_path_metrics(rows, path_prefix) when is_list(rows) and is_binary(path_prefix) do
    prefix = normalize_path_prefix(path_prefix)

    pages =
      rows
      |> Enum.map(&normalize_path_metric/1)
      |> Enum.filter(fn row -> path_in_scope?(row.path, prefix) end)
      |> Enum.sort_by(& &1.pageviews, :desc)
      |> Enum.take(10)

    summary =
      Enum.reduce(pages, empty_summary(), fn row, acc ->
        %{
          pageviews: acc.pageviews + row.pageviews,
          visitors: acc.visitors + row.visitors,
          visits: acc.visits + row.visits,
          bounces: acc.bounces + row.bounces,
          total_time: acc.total_time + row.total_time
        }
      end)

    %{
      summary: summary,
      timeseries: [],
      top_pages: pages,
      top_referrers: []
    }
  end

  defp path_metrics(%{client: client, website_id: website_id}, range) do
    client
    |> Tesla.get("/api/websites/#{website_id}/metrics/expanded",
      query: [
        startAt: Map.fetch!(range, :start_at),
        endAt: Map.fetch!(range, :end_at),
        type: "path",
        limit: @default_limit
      ]
    )
    |> parse_rows()
  end

  defp request_config(config) do
    with {:ok, website_id} <- fetch_config(config, :website_id),
         {:ok, api_token} <- fetch_config(config, :api_token) do
      timeout = Map.get(config, :timeout, 4000)

      client =
        Tesla.client([
          {Tesla.Middleware.BaseUrl, @origin},
          {Tesla.Middleware.Headers, [{"Authorization", "Bearer #{api_token}"}]},
          {Tesla.Middleware.Retry,
           delay: @idempotent_retry_delay, max_retries: @idempotent_retry_count},
          {Tesla.Middleware.Timeout, timeout: timeout},
          {Tesla.Middleware.JSON, engine: Jason}
        ])

      {:ok, %{client: client, website_id: website_id}}
    end
  end

  defp fetch_config(config, key) do
    case Map.get(config, key) do
      value when is_binary(value) and value != "" -> {:ok, value}
      _ -> {:error, :not_configured}
    end
  end

  defp parse_rows({:ok, %Tesla.Env{status: status, body: body}}) when status in 200..299 do
    if is_list(body), do: {:ok, body}, else: {:ok, []}
  end

  defp parse_rows({:ok, %Tesla.Env{status: status}}), do: {:error, {:http_error, status}}
  defp parse_rows({:error, reason}), do: {:error, reason}

  defp normalize_path_metric(row) when is_map(row) do
    %{
      path: read_string(row, "name") || read_string(row, :name) || "",
      title: read_string(row, "title") || read_string(row, :title),
      pageviews: read_int(row, "pageviews"),
      visitors: read_int(row, "visitors"),
      visits: read_int(row, "visits"),
      bounces: read_int(row, "bounces"),
      total_time: read_first_int(row, ["totaltime", :totaltime, "totalTime"])
    }
  end

  defp normalize_path_prefix(prefix) do
    prefix
    |> String.trim()
    |> then(fn value -> if String.starts_with?(value, "/"), do: value, else: "/#{value}" end)
    |> String.trim_trailing("/")
  end

  defp path_in_scope?(path, prefix) do
    path == prefix or String.starts_with?(path, "#{prefix}/")
  end

  defp empty_summary do
    %{pageviews: 0, visitors: 0, visits: 0, bounces: 0, total_time: 0}
  end

  defp read_string(map, key) do
    case Map.get(map, key) do
      value when is_binary(value) -> value
      _ -> nil
    end
  end

  defp read_int(map, key) do
    case Map.get(map, key) do
      value when is_integer(value) ->
        value

      value when is_float(value) ->
        trunc(value)

      value when is_binary(value) ->
        case Integer.parse(value) do
          {int, ""} -> int
          _ -> 0
        end

      _ ->
        0
    end
  end

  defp read_first_int(map, keys) do
    keys
    |> Enum.map(&read_int(map, &1))
    |> Enum.find(0, &(&1 > 0))
  end
end
