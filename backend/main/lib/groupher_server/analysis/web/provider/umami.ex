defmodule GroupherServer.Analysis.Web.Provider.Umami do
  alias GroupherServer.CMS.ErrorCat

  @moduledoc """
  Umami adapter for Groupher Web Analysis.

  Every request is scoped to the server-derived Umami website ID for the current
  community. This module deliberately returns normalized Groupher data instead
  of raw Umami response bodies.

  Business position:

      Main / Dashboard
        -> GraphQL
        -> Analysis
        -> Umami
        -> Repo / analytics provider
  """

  @behaviour GroupherServer.Analysis.Web.Provider

  use Tesla

  alias GroupherServer.Analysis.Web.Community
  alias GroupherServer.Analysis.Web.Config
  require Logger

  @config Config.base()
  @page_dimensions [:path, :entry, :exit, :title, :query]
  @source_dimensions [:referrer, :channel, :domain]
  @environment_dimensions [:browser, :os, :device, :language, :screen]
  @location_dimensions [:country, :region, :city]
  @visitor_location_limit 500

  plug(Tesla.Middleware.JSON, engine: Jason)

  @impl true
  def summary(%Community{} = community, range) do
    with {:ok, request} <- request_config(community.umami_website_id),
         {:ok, rows} <- dimension_metrics(request, range, :path) do
      {:ok, aggregate_path_metrics(rows)}
    end
  end

  @impl true
  def overview(%Community{} = community, range) do
    with {:ok, request} <- request_config(community.umami_website_id) do
      {sections, errors} =
        run_sections(
          summary: fn -> stats(request, range) end,
          chart: fn -> chart(request, range) end
        )

      {summary, previous_summary} =
        Map.get(sections, :summary, {empty_summary(), empty_summary()})

      {:ok,
       %{
         summary: summary,
         previous_summary: previous_summary,
         chart: Map.get(sections, :chart, []),
         errors: errors
       }}
    end
  end

  @impl true
  def active(%Community{} = community) do
    with {:ok, request} <- request_config(community.umami_website_id) do
      fetch_active(request)
    end
  end

  @impl true
  def pages(%Community{} = community, range, dimension) when dimension in @page_dimensions do
    with {:ok, request} <- request_config(community.umami_website_id),
         {:ok, rows} <- dimension_metrics(request, range, dimension) do
      {:ok, normalize_page_dimension_rows(rows, dimension)}
    end
  end

  @impl true
  def sources(%Community{} = community, range, dimension) when dimension in @source_dimensions do
    with {:ok, request} <- request_config(community.umami_website_id),
         {:ok, rows} <- dimension_metrics(request, range, dimension) do
      {:ok, normalize_dimension_rows(rows, dimension)}
    end
  end

  @impl true
  def environment(%Community{} = community, range, dimension)
      when dimension in @environment_dimensions do
    with {:ok, request} <- request_config(community.umami_website_id),
         {:ok, rows} <- dimension_metrics(request, range, dimension) do
      {:ok, normalize_dimension_rows(rows, dimension)}
    end
  end

  @impl true
  def location(%Community{} = community, range, dimension)
      when dimension in @location_dimensions do
    with {:ok, request} <- request_config(community.umami_website_id),
         {:ok, rows} <- dimension_metrics(request, range, dimension) do
      {:ok, normalize_location_rows(normalize_dimension_rows(rows, dimension), dimension)}
    end
  end

  @impl true
  def visitor_locations(%Community{} = community, range) do
    with {:ok, request} <- request_config(community.umami_website_id) do
      {sections, errors} =
        run_sections(
          country: fn -> dimension_metrics(request, range, :country, @visitor_location_limit) end,
          region: fn -> dimension_metrics(request, range, :region, @visitor_location_limit) end
        )

      case Map.fetch(sections, :country) do
        {:ok, country_rows} ->
          region_error =
            errors |> Enum.find_value(fn {section, reason} -> section == :region && reason end)

          {:ok,
           %{
             countries: normalize_visitor_country_rows(country_rows),
             regions: normalize_visitor_region_rows(Map.get(sections, :region, [])),
             region_error: region_error
           }}

        :error ->
          {:error,
           errors |> Enum.find_value(fn {section, reason} -> section == :country && reason end) ||
             :country_unavailable}
      end
    end
  end

  @impl true
  def traffic(%Community{} = community, range) do
    with {:ok, request} <- request_config(community.umami_website_id),
         {:ok, rows} <- weekly_sessions(request, range) do
      {:ok, %{timezone: "UTC", cells: normalize_weekly_cells(rows)}}
    end
  end

  @impl true
  def create_website(%Community{community: slug}) do
    with {:ok, request} <- request_config(nil) do
      case find_existing_website_id(request, slug, "groupher.com") do
        {:ok, website_id} ->
          {:ok, website_id}

        {:error, %GroupherServer.ErrorCat.Error{reason: :external_not_found}} ->
          post_website(request, slug, "groupher.com")

        {:error, reason} ->
          {:error, reason}
      end
    end
  end

  @doc """
  Aggregates legacy shared-website rows by an exact community path boundary.

  This is kept for the legacy summary endpoint; v2 Trends never uses a path
  prefix as its authorization or collection boundary.
  """
  @spec aggregate_path_metrics(list(), String.t()) :: map()
  def aggregate_path_metrics(rows, path_prefix) when is_list(rows) and is_binary(path_prefix) do
    prefix = normalize_path_prefix(path_prefix)

    scoped_pages =
      rows
      |> Enum.map(&normalize_path_metric/1)
      |> Enum.filter(fn row -> path_in_scope?(row.path, prefix) end)

    aggregate_normalized_path_metrics(scoped_pages)
  end

  @spec aggregate_path_metrics(list()) :: map()
  def aggregate_path_metrics(rows) when is_list(rows) do
    rows
    |> Enum.map(&normalize_path_metric/1)
    |> Enum.reject(&(&1.path == ""))
    |> aggregate_normalized_path_metrics()
  end

  @doc false
  @spec normalize_stats(map()) :: {map(), map()}
  def normalize_stats(body) when is_map(body) do
    body = Map.get(body, "data") || Map.get(body, :data) || body
    comparison = Map.get(body, "comparison") || Map.get(body, :comparison) || %{}

    current = summary_from(body, :value)

    previous =
      if map_size(comparison) > 0,
        do: summary_from(comparison, :value),
        else: summary_from(body, :previous)

    {current, previous}
  end

  @doc false
  @spec normalize_active(map()) :: {:ok, %{visitors: non_neg_integer()}} | {:error, term()}
  def normalize_active(body) when is_map(body) do
    body = Map.get(body, "data") || Map.get(body, :data) || body
    value = Map.get(body, "visitors", Map.get(body, :visitors))

    case non_negative_int(value) do
      {:ok, visitors} -> {:ok, %{visitors: visitors}}
      :error -> {:error, ErrorCat.unexpected_external_response(body_kind(body))}
    end
  end

  def normalize_active(body), do: {:error, ErrorCat.unexpected_external_response(body_kind(body))}

  defp aggregate_normalized_path_metrics(scoped_pages) do
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

    %{
      summary: summary,
      timeseries: [],
      top_pages: Enum.sort_by(scoped_pages, & &1.pageviews, :desc) |> Enum.take(10),
      top_referrers: []
    }
  end

  if Mix.env() == :test do
    def run_sections_for_test(sections, timeout \\ @config.timeout + 1_000),
      do: run_sections(sections, timeout)
  end

  defp run_sections(sections, timeout \\ @config.timeout + 1_000) do
    sections
    |> Enum.map(fn {section, fun} ->
      {section, Task.async(fn -> run_section(fun) end)}
    end)
    |> Enum.map(fn {section, task} ->
      result =
        case Task.yield(task, timeout) do
          {:exit, :timeout} ->
            :timeout

          nil ->
            Task.shutdown(task, :brutal_kill)
            :timeout

          other_result ->
            other_result
        end

      {section, task, result}
    end)
    |> Enum.reduce({%{}, []}, fn
      {section, _task, {:ok, {:ok, value}}}, {results, errors} ->
        {Map.put(results, section, value), errors}

      {section, _task, {:ok, {:error, reason}}}, {results, errors} ->
        {results, [{section, reason} | errors]}

      {section, _task, :timeout}, {results, errors} ->
        {results, [{section, :timeout} | errors]}

      {section, _task, nil}, {results, errors} ->
        {results, [{section, :timeout} | errors]}

      {section, _task, {:exit, reason}}, {results, errors} ->
        {results, [{section, reason} | errors]}

      {section, _task, unexpected}, {results, errors} ->
        {results, [{section, {:unexpected_task_result, unexpected}} | errors]}
    end)
    |> then(fn {results, errors} -> {results, Enum.reverse(errors)} end)
  end

  defp run_section(fun) do
    try do
      fun.()
    rescue
      error -> {:error, ErrorCat.external_unavailable(Exception.message(error))}
    catch
      :exit, reason -> {:error, ErrorCat.external_unavailable(reason)}
      _kind, reason -> {:error, ErrorCat.external_unavailable(reason)}
    end
  end

  defp stats(%{client: client, website_id: website_id}, range) do
    client
    |> Tesla.get("/api/websites/#{website_id}/stats",
      query: [startAt: Map.fetch!(range, :start_at), endAt: Map.fetch!(range, :end_at)]
    )
    |> parse_stats()
  end

  defp chart(%{client: client, website_id: website_id}, range) do
    client
    |> Tesla.get("/api/websites/#{website_id}/pageviews",
      query: [
        startAt: Map.fetch!(range, :start_at),
        endAt: Map.fetch!(range, :end_at),
        unit: Map.get(range, :bucket, "day"),
        timezone: "UTC"
      ]
    )
    |> parse_timeseries_rows()
    |> case do
      {:ok, rows} -> {:ok, normalize_timeseries_rows(rows, Map.get(range, :bucket, "day"))}
      {:error, reason} -> {:error, reason}
    end
  end

  defp fetch_active(%{client: client, website_id: website_id}) do
    client
    |> Tesla.get("/api/websites/#{website_id}/active")
    |> parse_active()
  end

  defp dimension_metrics(request, range, dimension),
    do: dimension_metrics(request, range, dimension, @config.metrics_limit)

  defp dimension_metrics(%{client: client, website_id: website_id}, range, dimension, limit) do
    client
    |> Tesla.get("/api/websites/#{website_id}/metrics/expanded",
      query: [
        startAt: Map.fetch!(range, :start_at),
        endAt: Map.fetch!(range, :end_at),
        type: Atom.to_string(dimension),
        limit: limit
      ]
    )
    |> parse_rows("metrics/expanded type=#{dimension}")
  end

  defp weekly_sessions(%{client: client, website_id: website_id}, range) do
    client
    |> Tesla.get("/api/websites/#{website_id}/sessions/weekly",
      query: [
        startAt: Map.fetch!(range, :start_at),
        endAt: Map.fetch!(range, :end_at),
        timezone: "UTC"
      ]
    )
    |> parse_rows("sessions/weekly")
  end

  defp find_existing_website_id(%{client: client}, name, domain) do
    case client |> Tesla.get("/api/websites") |> parse_website_rows() do
      {:ok, rows} ->
        rows
        |> Enum.find(fn row ->
          (read_string(row, "name") || read_string(row, :name)) == name and
            (read_string(row, "domain") || read_string(row, :domain)) == domain
        end)
        |> case do
          nil -> {:error, ErrorCat.external_not_found()}
          row -> parse_website_id(row)
        end

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp post_website(%{client: client}, name, domain) do
    with {:ok, %Tesla.Env{status: status, body: body}} when status in 200..299 <-
           Tesla.post(client, "/api/websites", %{name: name, domain: domain}),
         {:ok, website_id} <- parse_website_id(body) do
      {:ok, website_id}
    else
      {:ok, %Tesla.Env{status: status, body: body}} ->
        Logger.warning("Umami create website returned HTTP #{status}: #{inspect_body(body)}")
        {:error, ErrorCat.external_unavailable(status)}

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp request_config(website_id) do
    runtime = Config.runtime()

    with {:ok, api_token} <- fetch_required_config(runtime.api_token) do
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

  defp fetch_required_config(value) when is_binary(value) and value != "", do: {:ok, value}
  defp fetch_required_config(_value), do: {:error, ErrorCat.not_configured()}

  defp parse_stats({:ok, %Tesla.Env{status: status, body: body}})
       when status in 200..299 and is_map(body),
       do: {:ok, normalize_stats(body)}

  defp parse_stats({:ok, %Tesla.Env{status: status, body: body}}) when status in 200..299 do
    Logger.warning("Umami stats returned unexpected body: #{inspect_body(body)}")
    {:error, ErrorCat.unexpected_external_response(body_kind(body))}
  end

  defp parse_stats({:ok, %Tesla.Env{status: status, body: body}}) do
    Logger.warning("Umami stats returned HTTP #{status}: #{inspect_body(body)}")
    {:error, ErrorCat.external_unavailable(status)}
  end

  defp parse_stats({:error, reason}), do: {:error, reason}

  defp parse_active({:ok, %Tesla.Env{status: status, body: body}})
       when status in 200..299 do
    normalize_active(body)
  end

  defp parse_active({:ok, %Tesla.Env{status: status, body: body}}) do
    Logger.warning("Umami active visitors returned HTTP #{status}: #{inspect_body(body)}")
    {:error, ErrorCat.external_unavailable(status)}
  end

  defp parse_active({:error, reason}), do: {:error, reason}

  defp parse_website_id(body) when is_map(body) do
    case read_string(body, "id") || read_string(body, :id) do
      id when is_binary(id) and id != "" -> {:ok, id}
      _ -> {:error, ErrorCat.unexpected_external_response(body_kind(body))}
    end
  end

  defp parse_website_id(body),
    do: {:error, ErrorCat.unexpected_external_response(body_kind(body))}

  defp parse_website_rows({:ok, %Tesla.Env{status: status, body: body}})
       when status in 200..299 do
    case rows_from(body) do
      {:ok, rows} -> {:ok, rows}
      :error -> {:error, ErrorCat.unexpected_external_response(body_kind(body))}
    end
  end

  defp parse_website_rows({:ok, %Tesla.Env{status: status, body: body}}) do
    Logger.warning("Umami websites returned HTTP #{status}: #{inspect_body(body)}")
    {:error, ErrorCat.external_unavailable(status)}
  end

  defp parse_website_rows({:error, reason}), do: {:error, reason}

  defp parse_rows({:ok, %Tesla.Env{status: status, body: body}}, _label)
       when status in 200..299 do
    case rows_from(body) do
      {:ok, rows} -> {:ok, rows}
      :error -> {:error, ErrorCat.unexpected_external_response(body_kind(body))}
    end
  end

  defp parse_rows({:ok, %Tesla.Env{status: status, body: body}}, label) do
    Logger.warning("Umami #{label} returned HTTP #{status}: #{inspect_body(body)}")
    {:error, ErrorCat.external_unavailable(status)}
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

  defp parse_timeseries_rows({:ok, %Tesla.Env{status: status, body: body}}) do
    Logger.warning("Umami pageviews returned HTTP #{status}: #{inspect_body(body)}")
    {:error, ErrorCat.external_unavailable(status)}
  end

  defp parse_timeseries_rows({:error, reason}), do: {:error, reason}

  defp rows_from(body) when is_list(body), do: {:ok, body}

  defp rows_from(body) when is_map(body) do
    case Map.get(body, "data") || Map.get(body, :data) do
      rows when is_list(rows) -> {:ok, rows}
      _ -> :error
    end
  end

  defp rows_from(_body), do: :error

  defp summary_from(body, mode) do
    %{
      pageviews: stat_value(body, "pageviews", mode),
      visitors: stat_value(body, "visitors", mode),
      visits: stat_value(body, "visits", mode),
      bounces: stat_value(body, "bounces", mode),
      total_time: stat_value(body, "totaltime", mode)
    }
  end

  defp stat_value(body, key, :value) do
    body
    |> Map.get(key, Map.get(body, String.to_atom(key)))
    |> numeric_value(["value", :value])
  end

  defp stat_value(body, key, :previous) do
    body
    |> Map.get(key, Map.get(body, String.to_atom(key)))
    |> numeric_value(["prev", :prev, "previous", :previous])
  end

  defp numeric_value(value, keys) when is_map(value) do
    keys
    |> Enum.map(&Map.get(value, &1))
    |> Enum.find_value(0, &read_scalar_int/1)
  end

  defp numeric_value(value, _keys), do: read_scalar_int(value)

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

  defp normalize_dimension_rows(rows, dimension) do
    total_visitors = rows |> Enum.map(&read_int(&1, "visitors")) |> Enum.sum()

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

  defp normalize_page_dimension_rows(rows, dimension) do
    rows
    |> Enum.map(fn row ->
      value = read_string(row, "name") || read_string(row, :name) || ""
      visits = read_int(row, "visits")
      include_engagement? = dimension in [:path, :title]

      %{
        value: value,
        label: normalize_page_dimension_label(value, dimension),
        metrics: %{
          visitors: read_int(row, "visitors"),
          visits: visits,
          views: read_int(row, "pageviews"),
          bounce_rate:
            if(include_engagement?, do: rate(read_int(row, "bounces"), visits), else: nil),
          visit_duration:
            if(include_engagement?,
              do: rate(read_first_int(row, ["totaltime", :totaltime, "totalTime"]), visits),
              else: nil
            )
        }
      }
    end)
    |> Enum.reject(&(&1.value == ""))
  end

  defp normalize_location_rows(rows, :country), do: Enum.map(rows, &Map.put(&1, :code, &1.value))
  defp normalize_location_rows(rows, _dimension), do: Enum.map(rows, &Map.put(&1, :code, nil))

  @doc false
  def normalize_visitor_country_rows(rows) when is_list(rows) do
    rows
    |> Enum.map(fn row ->
      code = row |> dimension_name() |> String.trim() |> String.upcase()
      %{code: code, visitors: read_int(row, "visitors")}
    end)
    |> Enum.filter(fn %{code: code, visitors: visitors} ->
      String.match?(code, ~r/^[A-Z]{2}$/) and visitors > 0
    end)
  end

  @doc false
  def normalize_visitor_region_rows(rows) when is_list(rows) do
    rows
    |> Enum.map(&normalize_visitor_region_row/1)
    |> Enum.reject(&is_nil/1)
  end

  defp normalize_visitor_region_row(row) do
    raw_region = row |> dimension_name() |> String.trim() |> String.upcase()

    explicit_country =
      ["country", :country, "countryCode", :country_code]
      |> Enum.find_value(fn key -> read_string(row, key) end)
      |> case do
        value when is_binary(value) -> value |> String.trim() |> String.upcase()
        _ -> nil
      end

    normalized = String.replace(raw_region, "_", "-")

    code =
      cond do
        String.match?(normalized, ~r/^[A-Z]{2}-[A-Z0-9]{1,3}$/) ->
          normalized

        String.match?(explicit_country || "", ~r/^[A-Z]{2}$/) and
            String.match?(normalized, ~r/^[A-Z0-9]{1,3}$/) ->
          "#{explicit_country}-#{normalized}"

        true ->
          nil
      end

    case code do
      <<country_code::binary-size(2), "-", _::binary>> ->
        visitors = read_int(row, "visitors")
        if visitors > 0, do: %{code: code, country_code: country_code, visitors: visitors}

      _ ->
        nil
    end
  end

  defp dimension_name(row), do: read_string(row, "name") || read_string(row, :name) || ""

  defp normalize_timeseries_rows(rows, bucket) do
    rows
    |> Enum.map(fn row ->
      %{
        timestamp: read_timestamp(row),
        views: read_first_int(row, ["pageviews", "views", "y"]),
        visits: read_first_int(row, ["visits", "sessions"])
      }
    end)
    |> Enum.reject(&(&1.timestamp == 0))
    |> Enum.sort_by(& &1.timestamp)
    |> Enum.map(&Map.put(&1, :bucket, bucket))
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
        row
        |> Map.get("hours")
        |> Enum.with_index()
        |> Enum.map(fn {hour_row, hour} ->
          weekly_cell(hour_row, read_int(row, "weekday"), hour)
        end)

      true ->
        []
    end
  end

  defp normalize_weekly_row(hour_values, weekday) when is_list(hour_values) do
    hour_values
    |> Enum.with_index()
    |> Enum.map(fn {value, hour} -> weekly_scalar_cell(value, weekday, hour) end)
  end

  defp normalize_weekly_row(_row, _weekday), do: []

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
    %{weekday: weekday, hour: hour, visitors: count, visits: count, views: 0}
  end

  defp normalize_path_prefix(prefix) do
    prefix
    |> String.trim()
    |> then(fn value -> if String.starts_with?(value, "/"), do: value, else: "/#{value}" end)
    |> String.trim_trailing("/")
  end

  defp path_in_scope?(path, prefix), do: path == prefix or String.starts_with?(path, "#{prefix}/")
  defp empty_summary, do: %{pageviews: 0, visitors: 0, visits: 0, bounces: 0, total_time: 0}

  defp read_string(map, key) do
    case Map.get(map, key) do
      value when is_binary(value) -> value
      _ -> nil
    end
  end

  defp read_int(map, key), do: map |> Map.get(key) |> read_scalar_int()
  defp read_scalar_int(value) when is_integer(value), do: value
  defp read_scalar_int(value) when is_float(value), do: trunc(value)

  defp read_scalar_int(value) when is_binary(value) do
    case Integer.parse(value) do
      {int, ""} -> int
      _ -> 0
    end
  end

  defp read_scalar_int(_value), do: 0

  defp non_negative_int(value) when is_integer(value) and value >= 0, do: {:ok, value}

  defp non_negative_int(value) when is_float(value) and value >= 0,
    do: {:ok, trunc(value)}

  defp non_negative_int(value) when is_binary(value) do
    case Integer.parse(value) do
      {int, ""} when int >= 0 -> {:ok, int}
      _ -> :error
    end
  end

  defp non_negative_int(_value), do: :error

  defp read_first_int(map, keys) do
    keys
    |> Enum.map(&read_int(map, &1))
    |> Enum.find(0, &(&1 > 0))
  end

  defp read_timestamp(map) do
    ["x", :x, "t", :t, "date", :date, "timestamp", :timestamp]
    |> Enum.map(&Map.get(map, &1))
    |> Enum.find_value(0, &timestamp_value/1)
  end

  defp timestamp_value(value) when is_integer(value), do: value
  defp timestamp_value(value) when is_float(value), do: trunc(value)

  defp timestamp_value(value) when is_binary(value) do
    case Integer.parse(value) do
      {timestamp, ""} ->
        timestamp

      _ ->
        case DateTime.from_iso8601(value) do
          {:ok, datetime, _offset} -> DateTime.to_unix(datetime, :millisecond)
          _ -> 0
        end
    end
  end

  defp timestamp_value(_value), do: 0

  defp body_kind(body) when is_list(body), do: :list
  defp body_kind(body) when is_map(body), do: :map
  defp body_kind(body) when is_binary(body), do: :string
  defp body_kind(_body), do: :unknown

  defp inspect_body(body) when is_map(body) do
    body
    |> Map.drop(["token", :token, "password", :password])
    |> inspect(limit: 10, printable_limit: 500)
  end

  defp inspect_body(body) when is_binary(body), do: body |> String.slice(0, 500) |> inspect()
  defp inspect_body(body), do: inspect(body, limit: 10, printable_limit: 500)

  defp normalize_dimension_value("", :referrer), do: "direct"
  defp normalize_dimension_value(value, _dimension), do: value
  defp normalize_dimension_label("", :referrer), do: "Direct"
  defp normalize_dimension_label(value, _dimension), do: value
  defp normalize_page_dimension_label(value, _dimension), do: value
  defp percentage(_value, 0), do: 0.0
  defp percentage(value, total), do: Float.round(value / total, 4)
  defp rate(_value, 0), do: 0.0
  defp rate(value, total), do: Float.round(value / total, 2)
end
