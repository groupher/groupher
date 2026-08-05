defmodule GroupherServer.Analysis.Web do
  @moduledoc """
  Web analysis dimension for the platform analysis context.

  This module owns Groupher's built-in traffic analysis surface. It is one
  dimension under `GroupherServer.Analysis`, not the whole analysis domain.
  """

  alias __MODULE__.Config
  alias __MODULE__.Community, as: AnalysisCommunity
  alias GroupherServer.{CMS, Repo}
  alias GroupherServer.CMS.Model.{Community, CommunityDashboard}
  alias __MODULE__.Provider.Umami
  alias Helper.Transaction

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
    range = resolve_range(args, @config)
    provider = @config.provider || Umami

    with {:ok, community_analysis} <- prepare_community(community, provider) do
      case provider.summary(community_analysis, range) do
        {:ok, payload} -> {:ok, ready_payload(payload, community_analysis, range)}
        {:error, reason} -> {:ok, unavailable_payload(community_analysis, range, reason)}
      end
    else
      {:error, reason} ->
        community_analysis = AnalysisCommunity.from_community(community)
        {:ok, unavailable_payload(community_analysis, range, reason)}
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
    range = resolve_range(args, @config)
    provider = @config.provider || Umami

    with {:ok, community_analysis} <- prepare_community(community, provider) do
      case provider.overview(community_analysis, range) do
        {:ok, payload} -> {:ok, overview_payload(payload, community_analysis, range)}
        {:error, reason} -> {:ok, unavailable_overview_payload(community_analysis, range, reason)}
      end
    else
      {:error, reason} ->
        community_analysis = AnalysisCommunity.from_community(community)
        {:ok, unavailable_overview_payload(community_analysis, range, reason)}
    end
  end

  @spec tracking_website_id(Community.t()) :: {:ok, String.t() | nil}
  def tracking_website_id(%Community{} = community) do
    provider = @config.provider || Umami

    with {:ok, community_analysis} <- prepare_community(community, provider) do
      {:ok, community_analysis.umami_website_id}
    else
      {:error, _reason} -> {:ok, nil}
    end
  end

  defp prepare_community(%Community{} = community, provider) do
    with :ok <- ensure_runtime_configured(),
         :ok <- ensure_persisted_community(community),
         {:ok, dashboard} <- CMS.Dashboard.Write.ensure_exist(community),
         {:ok, website_id} <- ensure_umami_website_id(community, dashboard, provider) do
      {:ok, AnalysisCommunity.from_community(community, website_id)}
    end
  end

  defp ensure_runtime_configured do
    case Config.runtime().api_token do
      token when is_binary(token) and token != "" -> :ok
      _ -> {:error, :not_configured}
    end
  end

  defp ensure_persisted_community(%Community{id: id}) when is_integer(id), do: :ok
  defp ensure_persisted_community(%Community{}), do: {:error, :community_not_persisted}

  defp ensure_umami_website_id(
         %Community{} = community,
         %CommunityDashboard{umami_website_id: nil} = dashboard,
         provider
       ) do
    Transaction.lock_global("community_dashboard:umami_website:#{community.id}", fn ->
      with {:ok, dashboard} <- reload_dashboard(dashboard) do
        case dashboard.umami_website_id do
          website_id when is_binary(website_id) -> {:ok, website_id}
          nil -> create_umami_website(community, dashboard, provider)
        end
      end
    end)
  end

  defp ensure_umami_website_id(
         _community,
         %CommunityDashboard{umami_website_id: website_id},
         _provider
       )
       when is_binary(website_id) do
    {:ok, website_id}
  end

  defp reload_dashboard(%CommunityDashboard{id: id}) do
    case Repo.get(CommunityDashboard, id) do
      %CommunityDashboard{} = dashboard -> {:ok, dashboard}
      nil -> {:error, :dashboard_not_found}
    end
  end

  defp create_umami_website(%Community{} = community, dashboard, provider) do
    community_analysis = AnalysisCommunity.from_community(community)

    with {:ok, website_id} <- provider.create_website(community_analysis),
         {:ok, _dashboard} <-
           dashboard
           |> CommunityDashboard.update_changeset(%{umami_website_id: website_id})
           |> Repo.update() do
      {:ok, website_id}
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
    errors = Map.get(payload, :errors, [])

    cond do
      errors == [] ->
        "ok"

      all_sections_failed?(errors) ->
        "unavailable"

      true ->
        "partial"
    end
  end

  defp overview_errors(payload) do
    payload
    |> Map.get(:errors, [])
    |> Enum.map(fn {section, reason} -> error_payload(reason, Atom.to_string(section)) end)
  end

  defp all_sections_failed?(errors) do
    failed_sections =
      errors
      |> Enum.map(fn {section, _reason} -> section end)
      |> MapSet.new()

    MapSet.subset?(
      MapSet.new([:summary, :timeseries, :pages, :sources, :environment, :location, :traffic]),
      failed_sections
    )
  end

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

  defp section_status([], "ok"), do: "ok"
  defp section_status([], status), do: status
  defp section_status(_items, status), do: status

  defp multi_section_status(groups, status) do
    if Enum.any?(groups, &(not blank?(&1))), do: status, else: section_status([], status)
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

  defp error_code(:not_configured), do: "not_configured"
  defp error_code({:http_error, _}), do: "provider_http_error"
  defp error_code(_), do: "provider_error"

  defp empty_summary do
    %{pageviews: 0, visitors: 0, visits: 0, bounces: 0, total_time: 0}
  end

  defp error_message(:not_configured), do: "web analysis is not configured"

  defp error_message({:http_error, status}), do: "umami returned HTTP #{status}"
  defp error_message(reason), do: inspect(reason)
end
