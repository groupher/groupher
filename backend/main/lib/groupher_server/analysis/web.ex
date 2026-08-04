defmodule GroupherServer.Analysis.Web do
  @moduledoc """
  Web analysis dimension for the platform analysis context.

  This module owns Groupher's built-in traffic analysis surface. It is one
  dimension under `GroupherServer.Analysis`, not the whole analysis domain.
  """

  alias __MODULE__.Community, as: AnalysisCommunity
  alias __MODULE__.Config
  alias GroupherServer.CMS.Model.Community
  alias __MODULE__.Provider.Umami

  @config Config.base()

  @doc """
  Returns the legacy path-scoped Web Analysis summary for one community.

  The result is a Groupher-owned DTO. Provider credentials and raw provider
  response fields never cross this boundary.

  ## Example

      Analysis.Web.summary(%Community{slug: "home"}, %{days: 7})
      #=> {:ok, %{status: "ready", path_scope: "/home", summary: %{...}}}

  """
  @spec summary(Community.t(), map()) :: {:ok, map()}
  def summary(%Community{} = community, args \\ %{}) do
    community_analysis = AnalysisCommunity.from_community(community)
    range = resolve_range(args, @config)
    provider = @config.provider || Umami

    case provider.summary(community_analysis, range) do
      {:ok, payload} -> {:ok, ready_payload(payload, community_analysis, range)}
      {:error, reason} -> {:ok, unavailable_payload(community_analysis, range, reason)}
    end
  end

  @doc """
  Returns the v2 Web Analysis overview DTO for one community.

  The overview contains section-level status and errors so Dashboard can render
  partial data when a provider dimension is unavailable for path-scoped queries.
  The community path scope is derived server-side from the `Community` struct.

  ## Example

      Analysis.Web.overview(%Community{slug: "home"}, %{days: 7})
      #=> {:ok, %{status: "partial", path_scope: "/home", summary: %{...}, pages: %{...}}}

  """
  @spec overview(Community.t(), map()) :: {:ok, map()}
  def overview(%Community{} = community, args \\ %{}) do
    community_analysis = AnalysisCommunity.from_community(community)
    range = resolve_range(args, @config)
    provider = @config.provider || Umami

    case provider.overview(community_analysis, range) do
      {:ok, payload} -> {:ok, overview_payload(payload, community_analysis, range)}
      {:error, reason} -> {:ok, unavailable_overview_payload(community_analysis, range, reason)}
    end
  end

  defp resolve_range(args, config) do
    days = args |> Map.get(:days, config.default_days) |> clamp_days(config)
    end_at = DateTime.utc_now() |> DateTime.to_unix(:millisecond)
    start_at = end_at - days * 24 * 60 * 60 * 1000

    %{days: days, start_at: start_at, end_at: end_at, bucket: bucket(days)}
  end

  defp clamp_days(days, config) when is_integer(days), do: days |> max(1) |> min(config.max_days)
  defp clamp_days(_, config), do: config.default_days
  defp bucket(days) when days <= 2, do: "hour"
  defp bucket(_), do: "day"

  defp ready_payload(payload, scope, range) do
    %{
      status: "ready",
      provider: "umami",
      path_scope: scope.path_prefix,
      range: range,
      summary: Map.get(payload, :summary, empty_summary()),
      timeseries: Map.get(payload, :timeseries, []),
      top_pages: Map.get(payload, :top_pages, []),
      top_referrers: Map.get(payload, :top_referrers, []),
      error: nil
    }
  end

  defp unavailable_payload(scope, range, reason) do
    %{
      status: "unavailable",
      provider: "umami",
      path_scope: scope.path_prefix,
      range: range,
      summary: empty_summary(),
      timeseries: [],
      top_pages: [],
      top_referrers: [],
      error: error_message(reason)
    }
  end

  defp overview_payload(payload, scope, range) do
    summary = Map.get(payload, :summary, empty_summary())
    previous_summary = Map.get(payload, :previous_summary, empty_summary())

    %{
      status: overview_status(payload),
      provider: "umami",
      path_scope: scope.path_prefix,
      range: range,
      filters: nil,
      summary: overview_summary(summary, previous_summary),
      timeseries: timeseries_section(Map.get(payload, :timeseries, []), range),
      pages: pages_section(payload),
      sources: sources_section(payload),
      environment: environment_section(Map.get(payload, :environment, %{})),
      location: location_section(Map.get(payload, :location, %{})),
      traffic: traffic_section(Map.get(payload, :traffic, %{})),
      errors: overview_errors(payload)
    }
  end

  defp unavailable_overview_payload(scope, range, reason) do
    %{
      status: "unavailable",
      provider: "umami",
      path_scope: scope.path_prefix,
      range: range,
      filters: nil,
      summary: overview_summary(empty_summary(), empty_summary()),
      timeseries: timeseries_section([], range, "unavailable"),
      pages: pages_section(%{}, "unavailable"),
      sources: sources_section(%{}, "unavailable"),
      environment: environment_section(%{}, "unavailable"),
      location: location_section(%{}, "unavailable"),
      traffic: traffic_section(%{}, "unavailable"),
      errors: [error_payload(reason, "overview")]
    }
  end

  defp overview_status(payload) do
    required_sections = [
      Map.get(payload, :timeseries, []),
      get_in(payload, [:sources, :referrer]) || Map.get(payload, :top_referrers, []),
      get_in(payload, [:environment, :browser]),
      get_in(payload, [:location, :country]),
      get_in(payload, [:traffic, :cells])
    ]

    if Enum.any?(required_sections, &blank?/1) do
      "partial"
    else
      "ok"
    end
  end

  defp overview_errors(payload) do
    []
    |> maybe_add_empty_error(Map.get(payload, :timeseries, []), "timeseries")
    |> maybe_add_empty_error(get_in(payload, [:sources, :referrer]), "sources")
    |> maybe_add_empty_error(get_in(payload, [:environment, :browser]), "environment")
    |> maybe_add_empty_error(get_in(payload, [:location, :country]), "location")
    |> maybe_add_empty_error(get_in(payload, [:traffic, :cells]), "traffic")
  end

  defp maybe_add_empty_error(errors, value, section) when value in [nil, []] do
    [error_payload(:not_available_for_path_scope, section) | errors]
  end

  defp maybe_add_empty_error(errors, _items, _section), do: errors

  defp overview_summary(summary, previous_summary) do
    %{
      pageviews: metric(summary.pageviews, previous_summary.pageviews),
      visitors: metric(summary.visitors, previous_summary.visitors),
      visits: metric(summary.visits, previous_summary.visits),
      bounce_rate:
        metric(
          rate(summary.bounces, summary.visits),
          rate(previous_summary.bounces, previous_summary.visits)
        ),
      visit_duration:
        metric(
          rate(summary.total_time, summary.visits),
          rate(previous_summary.total_time, previous_summary.visits)
        )
    }
  end

  defp metric(value, previous_value) do
    %{
      value: value,
      previous_value: previous_value,
      change_rate: change_rate(value, previous_value)
    }
  end

  defp change_rate(_value, previous_value) when previous_value in [0, 0.0], do: nil

  defp change_rate(value, previous_value),
    do: Float.round((value - previous_value) / previous_value * 100, 2)

  defp rate(_value, 0), do: 0.0
  defp rate(value, total), do: Float.round(value / total, 2)

  defp timeseries_section(points, range, status \\ "ok") do
    %{
      status: section_status(points, status),
      bucket: range.bucket,
      points: points
    }
  end

  defp pages_section(payload, status \\ "ok") when is_map(payload) do
    items = Map.get(payload, :top_pages, [])
    pages = Map.get(payload, :pages, %{})
    path = Enum.map(items, &page_metric/1)
    url = Map.get(pages, :url, [])
    entry = Map.get(pages, :entry, [])
    exit = Map.get(pages, :exit, [])
    title = Map.get(pages, :title, [])
    query = Map.get(pages, :query, [])

    %{
      status: multi_section_status([path, url, entry, exit, title, query], status),
      path: path,
      url: url,
      entry: entry,
      exit: exit,
      title: title,
      query: query
    }
  end

  defp sources_section(payload, status \\ "ok") do
    items = Map.get(payload, :top_referrers, [])
    sources = Map.get(payload, :sources, %{})
    referrer = Map.get(sources, :referrer, items)
    channel = Map.get(sources, :channel, [])
    domain = Map.get(sources, :domain, [])

    %{
      status: multi_section_status([referrer, channel, domain], status),
      referrer: referrer,
      channel: channel,
      domain: domain
    }
  end

  defp environment_section(items, status \\ "ok") do
    browser = Map.get(items, :browser, [])
    os = Map.get(items, :os, [])
    device = Map.get(items, :device, [])
    language = Map.get(items, :language, [])
    screen = Map.get(items, :screen, [])

    %{
      status: multi_section_status([browser, os, device, language, screen], status),
      browser: browser,
      os: os,
      device: device,
      language: language,
      screen: screen
    }
  end

  defp location_section(items, status \\ "ok") do
    country = Map.get(items, :country, [])
    region = Map.get(items, :region, [])
    city = Map.get(items, :city, [])

    %{
      status: multi_section_status([country, region, city], status),
      country: country,
      region: region,
      city: city
    }
  end

  defp traffic_section(items, status \\ "ok") do
    cells = Map.get(items, :cells, [])

    %{
      status: section_status(cells, status),
      timezone: Map.get(items, :timezone, "UTC"),
      cells: cells
    }
  end

  defp section_status([], _status), do: "unavailable"
  defp section_status(_items, status), do: status

  defp multi_section_status(groups, status) do
    if Enum.any?(groups, &(not blank?(&1))), do: status, else: "unavailable"
  end

  defp blank?(value), do: value in [nil, []]

  defp page_metric(page) do
    %{
      value: page.path,
      label: page.title || page.path,
      metrics: %{
        visitors: page.visitors,
        visits: page.visits,
        views: page.pageviews,
        bounce_rate: rate(page.bounces, page.visits),
        visit_duration: rate(page.total_time, page.visits)
      }
    }
  end

  defp error_payload(reason, section) do
    %{
      code: error_code(reason),
      message: error_message(reason),
      section: section,
      provider_status: nil
    }
  end

  defp error_code(:not_available_for_path_scope), do: "not_available_for_path_scope"
  defp error_code(:not_configured), do: "not_configured"
  defp error_code({:http_error, _}), do: "provider_http_error"
  defp error_code(_), do: "provider_error"

  defp empty_summary do
    %{pageviews: 0, visitors: 0, visits: 0, bounces: 0, total_time: 0}
  end

  defp error_message(:not_configured), do: "web analysis is not configured"

  defp error_message(:not_available_for_path_scope),
    do: "data is not available for path-scoped queries"

  defp error_message({:http_error, status}), do: "umami returned HTTP #{status}"
  defp error_message(reason), do: inspect(reason)
end
