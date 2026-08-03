defmodule GroupherServer.Analysis.Web.Provider.Umami do
  @moduledoc """
  Umami adapter for Groupher Web Analysis.

  v1 uses one global Umami website and derives community isolation from URL
  paths. Since Umami path filters are exact-value filters, this adapter queries
  path metrics and applies prefix filtering before returning the Dashboard DTO.
  """

  @behaviour GroupherServer.Analysis.Web.Provider

  use Tesla

  alias GroupherServer.Analysis.Web.Config
  alias GroupherServer.Analysis.Web.Community

  @config Config.base()

  plug(Tesla.Middleware.JSON, engine: Jason)

  @doc """
  Returns the legacy path-scoped summary payload for one community.

  The summary is derived from expanded path metrics, then filtered by the
  server-derived community path prefix.

  ## Example

      summary(%Community{community: "home", path_prefix: "/home"}, range)
      #=> {:ok, %{summary: %{pageviews: 10, visitors: 4, visits: 5, bounces: 1, total_time: 60}}}

  """
  @impl true
  def summary(%Community{} = community, range) do
    with {:ok, request} <- request_config(),
         {:ok, rows} <- path_metrics(request, range) do
      {:ok, aggregate_path_metrics(rows, community.path_prefix)}
    end
  end

  @doc """
  Returns the path-scoped overview payload for one community.

  The provider queries the current range and the immediately previous
  equal-duration range, then applies Groupher's community path-prefix filter
  before returning the DTO consumed by `GroupherServer.Analysis.Web`.

  ## Example

      range = %{start_at: 1_700_000_000_000, end_at: 1_700_604_800_000, bucket: "day"}
      community = %GroupherServer.Analysis.Web.Community{community: "home", path_prefix: "/home"}

      overview(community, range)
      #=> {:ok, %{summary: summary, previous_summary: previous_summary, timeseries: [], top_referrers: []}}

  """
  @impl true
  def overview(%Community{} = community, range) do
    with {:ok, request} <- request_config(),
         {:ok, current_rows} <- path_metrics(request, range),
         {:ok, previous_rows} <- path_metrics(request, previous_range(range)) do
      current_metrics = aggregate_path_metrics(current_rows, community.path_prefix)
      previous_summary = aggregate_path_metrics(previous_rows, community.path_prefix).summary

      {:ok,
       current_metrics
       |> Map.put(
         :previous_summary,
         previous_summary
       )
       |> Map.put(:timeseries, [])
       |> Map.put(:top_referrers, [])}
    end
  end

  @doc """
  Aggregates expanded Umami path metric rows under a community path prefix.

  This is public for tests because it is the core isolation rule for the shared
  global Umami website model.

  ## Example

      aggregate_path_metrics([%{"name" => "/home/post", "pageviews" => 2}], "/home")
      #=> %{summary: %{pageviews: 2, visitors: 0, visits: 0, bounces: 0, total_time: 0}, top_pages: [%{path: "/home/post", pageviews: 2, ...}], timeseries: [], top_referrers: []}

  """
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

  defp path_metrics(
         %{client: client, website_id: website_id},
         range
       ) do
    client
    |> Tesla.get("/api/websites/#{website_id}/metrics/expanded",
      query: [
        startAt: Map.fetch!(range, :start_at),
        endAt: Map.fetch!(range, :end_at),
        type: "path",
        limit: @config.metrics_limit
      ]
    )
    |> parse_rows()
  end

  defp previous_range(%{start_at: start_at, end_at: end_at}) do
    duration = end_at - start_at

    %{
      start_at: start_at - duration,
      end_at: start_at
    }
  end

  defp request_config do
    runtime = Config.runtime()

    with {:ok, website_id} <- fetch_required_config(runtime.website_id),
         {:ok, api_token} <- fetch_required_config(runtime.api_token) do
      client =
        Tesla.client([
          {Tesla.Middleware.BaseUrl, @config.origin},
          {Tesla.Middleware.Headers, [{"Authorization", "Bearer #{api_token}"}]},
          {Tesla.Middleware.Retry, delay: @config.retry_delay, max_retries: @config.retry_count},
          {Tesla.Middleware.Timeout, timeout: @config.timeout},
          {Tesla.Middleware.JSON, engine: Jason}
        ])

      {:ok, %{client: client, website_id: website_id}}
    end
  end

  defp fetch_required_config(value) do
    case value do
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
