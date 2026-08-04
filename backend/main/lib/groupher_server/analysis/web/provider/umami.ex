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
  require Logger

  @config Config.base()
  @page_dimensions [:url, :entry, :exit, :title, :query]
  @source_dimensions [:referrer, :channel, :domain]
  @environment_dimensions [:browser, :os, :device, :language, :screen]
  @location_dimensions [:country, :region, :city]

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
      #=> {:ok, %{summary: summary, previous_summary: previous_summary, timeseries: points, top_referrers: []}}

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
       |> Map.put(:timeseries, timeseries(request, range, community.path_prefix))
       |> Map.put(:pages, page_group(request, range, community.path_prefix))
       |> Map.put(
         :sources,
         dimension_group(request, range, community.path_prefix, @source_dimensions)
       )
       |> Map.put(
         :environment,
         dimension_group(request, range, community.path_prefix, @environment_dimensions)
       )
       |> Map.put(:location, location_group(request, range, community.path_prefix))
       |> Map.put(:traffic, traffic_heatmap(request, range, community.path_prefix))}
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

    scoped_pages =
      rows
      |> Enum.map(&normalize_path_metric/1)
      |> Enum.filter(fn row -> path_in_scope?(row.path, prefix) end)

    if rows != [] and scoped_pages == [] do
      rows
      |> Enum.map(&normalize_path_metric/1)
      |> Enum.map(& &1.path)
      |> Enum.reject(&(&1 == ""))
      |> Enum.take(5)
      |> then(fn sample_paths ->
        Logger.warning(
          "Umami path metrics returned no scoped rows for prefix=#{prefix}; sample_paths=#{inspect(sample_paths)}"
        )
      end)
    end

    summary =
      Enum.reduce(scoped_pages, empty_summary(), fn row, acc ->
        %{
          pageviews: acc.pageviews + row.pageviews,
          visitors: acc.visitors + row.visitors,
          visits: acc.visits + row.visits,
          bounces: acc.bounces + row.bounces,
          total_time: acc.total_time + row.total_time
        }
      end)

    top_pages =
      scoped_pages
      |> Enum.sort_by(& &1.pageviews, :desc)
      |> Enum.take(10)

    %{
      summary: summary,
      timeseries: [],
      top_pages: top_pages,
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
    |> parse_rows("metrics/expanded type=path")
  end

  defp dimension_metrics_for_path(%{client: client, website_id: website_id}, range, path, type) do
    client
    |> Tesla.get("/api/websites/#{website_id}/metrics/expanded",
      query: [
        startAt: Map.fetch!(range, :start_at),
        endAt: Map.fetch!(range, :end_at),
        type: Atom.to_string(type),
        limit: @config.metrics_limit,
        filters: Jason.encode!(%{path: path})
      ]
    )
    |> parse_rows("metrics/expanded type=#{type}")
  end

  defp pageviews_for_path(%{client: client, website_id: website_id}, range, path) do
    client
    |> Tesla.get("/api/websites/#{website_id}/pageviews",
      query: [
        startAt: Map.fetch!(range, :start_at),
        endAt: Map.fetch!(range, :end_at),
        unit: Map.get(range, :bucket, "day"),
        timezone: "UTC",
        filters: Jason.encode!(%{path: path})
      ]
    )
    |> parse_timeseries_rows()
  end

  defp weekly_sessions_for_path(%{client: client, website_id: website_id}, range, path) do
    client
    |> Tesla.get("/api/websites/#{website_id}/sessions/weekly",
      query: [
        startAt: Map.fetch!(range, :start_at),
        endAt: Map.fetch!(range, :end_at),
        timezone: "UTC",
        filters: Jason.encode!(%{path: path})
      ]
    )
    |> parse_rows("sessions/weekly")
  end

  defp scoped_paths(request, range, path_prefix) do
    prefix = normalize_path_prefix(path_prefix)

    with {:ok, rows} <- path_metrics(request, range) do
      paths =
        rows
        |> Enum.map(&normalize_path_metric/1)
        |> Enum.filter(fn row -> path_in_scope?(row.path, prefix) end)
        |> Enum.sort_by(& &1.pageviews, :desc)
        |> Enum.map(& &1.path)
        |> Enum.reject(&(&1 == ""))
        |> Enum.uniq()

      {:ok, paths}
    end
  end

  defp scoped_dimension_metrics(request, range, path_prefix, type) do
    with {:ok, paths} <- scoped_paths(request, range, path_prefix) do
      paths
      |> Enum.flat_map(fn path ->
        case dimension_metrics_for_path(request, range, path, type) do
          {:ok, rows} -> rows
          {:error, _reason} -> []
        end
      end)
      |> merge_metric_rows()
      |> then(&{:ok, &1})
    end
  end

  defp scoped_pageviews(request, range, path_prefix) do
    with {:ok, paths} <- scoped_paths(request, range, path_prefix) do
      paths
      |> Enum.flat_map(fn path ->
        case pageviews_for_path(request, range, path) do
          {:ok, rows} -> rows
          {:error, _reason} -> []
        end
      end)
      |> merge_timeseries_rows()
      |> then(&{:ok, &1})
    end
  end

  defp scoped_weekly_sessions(request, range, path_prefix) do
    with {:ok, paths} <- scoped_paths(request, range, path_prefix) do
      paths
      |> Enum.flat_map(fn path ->
        case weekly_sessions_for_path(request, range, path) do
          {:ok, rows} -> rows
          {:error, _reason} -> []
        end
      end)
      |> merge_weekly_rows()
      |> then(&{:ok, &1})
    end
  end

  defp dimension_group(request, range, path_prefix, dimensions) do
    Enum.reduce(dimensions, %{}, fn dimension, acc ->
      Map.put(acc, dimension, request_dimension(request, range, path_prefix, dimension))
    end)
  end

  defp page_group(request, range, path_prefix) do
    Enum.reduce(@page_dimensions, %{}, fn dimension, acc ->
      Map.put(acc, dimension, request_page_dimension(request, range, path_prefix, dimension))
    end)
  end

  defp request_page_dimension(request, range, path_prefix, dimension) do
    case scoped_dimension_metrics(request, range, path_prefix, dimension) do
      {:ok, rows} -> normalize_page_dimension_rows(rows, dimension)
      {:error, _reason} -> []
    end
  end

  defp timeseries(request, range, path_prefix) do
    case scoped_pageviews(request, range, path_prefix) do
      {:ok, rows} -> normalize_timeseries_rows(rows, Map.get(range, :bucket, "day"))
      {:error, _reason} -> []
    end
  end

  defp location_group(request, range, path_prefix) do
    request
    |> dimension_group(range, path_prefix, @location_dimensions)
    |> Map.update(:country, [], fn rows -> Enum.map(rows, &Map.put(&1, :code, &1.value)) end)
    |> Map.update(:region, [], fn rows -> Enum.map(rows, &Map.put(&1, :code, nil)) end)
    |> Map.update(:city, [], fn rows -> Enum.map(rows, &Map.put(&1, :code, nil)) end)
  end

  defp request_dimension(request, range, path_prefix, dimension) do
    case scoped_dimension_metrics(request, range, path_prefix, dimension) do
      {:ok, rows} -> normalize_dimension_rows(rows, dimension)
      {:error, _reason} -> []
    end
  end

  defp traffic_heatmap(request, range, path_prefix) do
    cells =
      case scoped_weekly_sessions(request, range, path_prefix) do
        {:ok, rows} -> normalize_weekly_cells(rows)
        {:error, _reason} -> []
      end

    %{timezone: "UTC", cells: cells}
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
          {Tesla.Middleware.Headers,
           [
             {"Accept", "application/json"},
             {"Authorization", "Bearer #{api_token}"},
             {"x-umami-api-key", api_token}
           ]},
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

  defp parse_rows({:ok, %Tesla.Env{status: status, body: body}}, label) when status in 200..299 do
    cond do
      is_list(body) ->
        {:ok, body}

      is_list(Map.get(body, "data")) ->
        {:ok, Map.get(body, "data")}

      is_list(Map.get(body, :data)) ->
        {:ok, Map.get(body, :data)}

      true ->
        Logger.warning("Umami #{label} returned unexpected rows body: #{inspect_body(body)}")
        {:error, {:unexpected_body, body_kind(body)}}
    end
  end

  defp parse_rows({:ok, %Tesla.Env{status: status, body: body}}, label) do
    Logger.warning("Umami #{label} returned HTTP #{status}: #{inspect_body(body)}")
    {:error, {:http_error, status}}
  end

  defp parse_rows({:error, reason}, _label), do: {:error, reason}

  defp parse_timeseries_rows({:ok, %Tesla.Env{status: status, body: body}})
       when status in 200..299 do
    cond do
      is_list(body) -> {:ok, body}
      is_list(Map.get(body, "pageviews")) -> {:ok, merge_timeseries_body(body)}
      is_list(Map.get(body, :pageviews)) -> {:ok, merge_timeseries_body(body)}
      true -> {:ok, []}
    end
  end

  defp parse_timeseries_rows({:ok, %Tesla.Env{status: status}}),
    do: {:error, {:http_error, status}}

  defp parse_timeseries_rows({:error, reason}), do: {:error, reason}

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

  defp normalize_dimension_rows(rows, dimension) when is_list(rows) do
    total_visitors =
      rows
      |> Enum.map(&read_int(&1, "visitors"))
      |> Enum.sum()

    rows
    |> Enum.map(fn row ->
      value = read_string(row, "name") || read_string(row, :name) || ""
      visitors = read_int(row, "visitors")

      %{
        value: normalize_dimension_value(value, dimension),
        label: normalize_dimension_label(value, dimension),
        metrics: %{
          visitors: visitors,
          visits: read_int(row, "visits"),
          views: read_int(row, "pageviews"),
          percentage: percentage(visitors, total_visitors)
        }
      }
    end)
    |> Enum.reject(&(&1.value == ""))
  end

  defp normalize_page_dimension_rows(rows, dimension) when is_list(rows) do
    rows
    |> Enum.map(fn row ->
      value = read_string(row, "name") || read_string(row, :name) || ""

      %{
        value: value,
        label: normalize_page_dimension_label(value, dimension),
        metrics: %{
          visitors: read_int(row, "visitors"),
          visits: read_int(row, "visits"),
          views: read_int(row, "pageviews"),
          bounce_rate: rate(read_int(row, "bounces"), read_int(row, "visits")),
          visit_duration:
            rate(
              read_first_int(row, ["totaltime", :totaltime, "totalTime"]),
              read_int(row, "visits")
            )
        }
      }
    end)
    |> Enum.reject(&(&1.value == ""))
  end

  defp normalize_timeseries_rows(rows, bucket) when is_list(rows) do
    rows
    |> Enum.map(fn row ->
      %{
        bucket: bucket,
        timestamp: read_timestamp(row),
        visitors: read_int(row, "visitors"),
        visits: read_first_int(row, ["visits", "sessions"]),
        views: read_first_int(row, ["pageviews", "views", "y"])
      }
    end)
    |> Enum.reject(&(&1.timestamp == 0))
  end

  defp merge_timeseries_body(body) do
    pageviews = Map.get(body, "pageviews") || Map.get(body, :pageviews) || []
    sessions = Map.get(body, "sessions") || Map.get(body, :sessions) || []

    sessions_by_timestamp =
      Map.new(sessions, &{read_timestamp(&1), read_first_int(&1, ["y", "sessions"])})

    Enum.map(pageviews, fn row ->
      timestamp = read_timestamp(row)

      %{
        "timestamp" => timestamp,
        "pageviews" => read_first_int(row, ["y", "pageviews"]),
        "visits" => Map.get(sessions_by_timestamp, timestamp, 0)
      }
    end)
  end

  defp merge_metric_rows(rows) do
    rows
    |> Enum.group_by(&(read_string(&1, "name") || read_string(&1, :name) || ""))
    |> Enum.map(fn {name, rows} ->
      Enum.reduce(rows, %{"name" => name}, fn row, acc ->
        Map.merge(acc, %{
          "pageviews" => Map.get(acc, "pageviews", 0) + read_int(row, "pageviews"),
          "visitors" => Map.get(acc, "visitors", 0) + read_int(row, "visitors"),
          "visits" => Map.get(acc, "visits", 0) + read_int(row, "visits"),
          "bounces" => Map.get(acc, "bounces", 0) + read_int(row, "bounces"),
          "totaltime" =>
            Map.get(acc, "totaltime", 0) +
              read_first_int(row, ["totaltime", :totaltime, "totalTime"])
        })
      end)
    end)
  end

  defp merge_timeseries_rows(rows) do
    rows
    |> Enum.group_by(&read_timestamp/1)
    |> Enum.map(fn {timestamp, rows} ->
      Enum.reduce(rows, %{"timestamp" => timestamp}, fn row, acc ->
        Map.merge(acc, %{
          "pageviews" =>
            Map.get(acc, "pageviews", 0) + read_first_int(row, ["pageviews", "views", "y"]),
          "visits" => Map.get(acc, "visits", 0) + read_first_int(row, ["visits", "sessions"]),
          "visitors" => Map.get(acc, "visitors", 0) + read_int(row, "visitors")
        })
      end)
    end)
  end

  defp merge_weekly_rows(rows) do
    rows
    |> normalize_weekly_cells()
    |> Enum.group_by(&{&1.weekday, &1.hour})
    |> Enum.map(fn {{weekday, hour}, cells} ->
      Enum.reduce(cells, %{"weekday" => weekday, "hour" => hour}, fn cell, acc ->
        Map.merge(acc, %{
          "pageviews" => Map.get(acc, "pageviews", 0) + cell.views,
          "visitors" => Map.get(acc, "visitors", 0) + cell.visitors,
          "visits" => Map.get(acc, "visits", 0) + cell.visits
        })
      end)
    end)
  end

  @doc false
  @spec normalize_weekly_cells(list()) :: list(map())
  def normalize_weekly_cells(rows) when is_list(rows) do
    rows
    |> Enum.with_index()
    |> Enum.flat_map(fn {row, weekday} -> normalize_weekly_row(row, weekday) end)
    |> Enum.filter(fn cell -> cell.weekday in 0..6 and cell.hour in 0..23 end)
  end

  defp normalize_weekly_row(row, _weekday_index) when is_map(row) do
    cond do
      is_integer(Map.get(row, "weekday")) and is_integer(Map.get(row, "hour")) ->
        [weekly_cell(row, Map.get(row, "weekday"), Map.get(row, "hour"))]

      is_list(Map.get(row, "hours")) ->
        weekday = read_int(row, "weekday")

        row
        |> Map.get("hours")
        |> Enum.with_index()
        |> Enum.map(fn {hour_row, hour} -> weekly_cell(hour_row, weekday, hour) end)

      true ->
        []
    end
  end

  defp normalize_weekly_row(hour_values, weekday) when is_list(hour_values) do
    hour_values
    |> Enum.with_index()
    |> Enum.map(fn {value, hour} -> weekly_scalar_cell(value, weekday, hour) end)
  end

  defp normalize_weekly_row(_row, _weekday_index), do: []

  defp weekly_cell(row, weekday, hour) do
    %{
      weekday: weekday,
      hour: hour,
      visitors: read_int(row, "visitors"),
      visits: read_int(row, "visits"),
      views: read_int(row, "pageviews")
    }
  end

  defp weekly_scalar_cell(value, weekday, hour) do
    count = read_scalar_int(value)

    %{
      weekday: weekday,
      hour: hour,
      visitors: count,
      visits: count,
      views: 0
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

  defp read_scalar_int(value) when is_integer(value), do: value
  defp read_scalar_int(value) when is_float(value), do: trunc(value)

  defp read_scalar_int(value) when is_binary(value) do
    case Integer.parse(value) do
      {int, ""} -> int
      _ -> 0
    end
  end

  defp read_scalar_int(_value), do: 0

  defp read_first_int(map, keys) do
    keys
    |> Enum.map(&read_int(map, &1))
    |> Enum.find(0, &(&1 > 0))
  end

  defp read_timestamp(map) do
    read_first_int(map, ["x", :x, "t", :t, "date", :date, "timestamp", :timestamp])
  end

  defp body_kind(body) when is_list(body), do: :list
  defp body_kind(body) when is_map(body), do: :map
  defp body_kind(body) when is_binary(body), do: :string
  defp body_kind(_body), do: :unknown

  defp inspect_body(body) when is_map(body) do
    body
    |> Map.drop(["token", :token, "password", :password])
    |> inspect(limit: 10, printable_limit: 500)
  end

  defp inspect_body(body) when is_binary(body) do
    body
    |> String.slice(0, 500)
    |> inspect()
  end

  defp inspect_body(body), do: inspect(body, limit: 10, printable_limit: 500)

  defp normalize_dimension_value("", :referrer), do: "direct"
  defp normalize_dimension_value(value, _dimension), do: value

  defp normalize_dimension_label("", :referrer), do: "Direct"
  defp normalize_dimension_label(value, _dimension), do: value

  defp normalize_page_dimension_label(value, :url), do: URI.parse(value).path || value
  defp normalize_page_dimension_label(value, _dimension), do: value

  defp percentage(_value, 0), do: 0.0
  defp percentage(value, total), do: Float.round(value / total, 4)
  defp rate(_value, 0), do: 0.0
  defp rate(value, total), do: Float.round(value / total, 2)
end
