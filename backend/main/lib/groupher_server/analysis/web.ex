defmodule GroupherServer.Analysis.Web do
  alias GroupherServer.CMS.ErrorCat

  @moduledoc """
  Groupher-owned Web Analysis context.

  This context resolves the trusted community analytics identity before it
  delegates to the vendor adapter. It returns Dashboard DTOs only: Umami
  credentials, raw response shapes, and website IDs never cross this boundary.

  Business position:

      Main / Dashboard
        -> GraphQL
        -> Analysis
        -> Web
        -> Repo / analytics provider
  """

  alias __MODULE__.Community, as: AnalysisCommunity
  alias __MODULE__.Config
  alias GroupherServer.CMS.Dashboard.Writer
  alias GroupherServer.CMS.Model.{Community, CommunityDashboard}
  alias GroupherServer.Repo
  alias Helper.{Cache, Transaction}

  @config Config.base()
  @active_cache_seconds 30
  @visitor_location_days 30
  @visitor_location_cache_seconds 15 * 60
  @visitor_location_error_cache_seconds 30
  @visitor_region_limit 10
  @visitor_region_countries ~w(CN US CA RU AU BR IN ID)

  @type page_dimension :: :path | :entry | :exit | :title | :query
  @type source_dimension :: :referrer | :channel | :domain
  @type environment_dimension :: :browser | :os | :device | :language | :screen
  @type location_dimension :: :country | :region | :city

  @page_dimensions [:path, :entry, :exit, :title, :query]
  @source_dimensions [:referrer, :channel, :domain]
  @environment_dimensions [:browser, :os, :device, :language, :screen]
  @location_dimensions [:country, :region, :city]

  @doc """
  Returns the legacy count-only summary DTO.

  `analysisWebSummary` remains available while existing clients migrate to the
  section-oriented Trends contract.
  """
  @spec summary(Community.t(), map()) :: {:ok, map()}
  def summary(%Community{} = community, args \\ %{}) do
    range = resolve_range(args)
    provider = provider()

    case prepare_community(community, provider) do
      {:ok, community_analysis} ->
        case provider.summary(community_analysis, range) do
          {:ok, payload} ->
            {:ok, ready_summary_payload(payload, community_analysis, range)}

          {:error, reason} ->
            {:ok, unavailable_summary_payload(community_analysis, range, reason)}
        end

      {:error, reason} ->
        {:ok,
         unavailable_summary_payload(AnalysisCommunity.from_community(community), range, reason)}
    end
  end

  @doc """
  Returns the SSR-sized Trends overview: summary metrics and the chart only.
  """
  @spec trends_overview(Community.t(), map()) :: {:ok, map()}
  def trends_overview(%Community{} = community, args \\ %{}) do
    range = resolve_range(args)
    provider = provider()

    case prepare_community(community, provider) do
      {:ok, community_analysis} ->
        case provider.overview(community_analysis, range) do
          {:ok, payload} -> {:ok, trends_overview_payload(payload, range)}
          {:error, reason} -> {:ok, unavailable_overview_payload(range, reason)}
        end

      {:error, reason} ->
        {:ok, unavailable_overview_payload(range, reason)}
    end
  end

  @doc """
  Returns the current active visitor count for one community.

  The provider result is cached briefly by the trusted Umami website identity
  so multiple dashboard clients do not all refresh the same upstream value.
  """
  @spec active(Community.t()) :: {:ok, %{visitors: non_neg_integer()}} | {:error, term()}
  def active(%Community{} = community) do
    provider = provider()

    with {:ok, community_analysis} <- prepare_community(community, provider),
         website_id when is_binary(website_id) <- community_analysis.umami_website_id do
      Cache.get_or_fetch(
        :common,
        "analysis.active.#{website_id}",
        [expire_sec: @active_cache_seconds],
        fn -> provider.active(community_analysis) end
      )
    end
  end

  @doc """
  Returns one selected page breakdown dimension.
  """
  @spec trend_pages(Community.t(), map(), page_dimension()) :: {:ok, map()}
  def trend_pages(%Community{} = community, args, dimension) when dimension in @page_dimensions do
    trend_items(community, args, :pages, fn community_analysis, range ->
      provider().pages(community_analysis, range, dimension)
    end)
  end

  @doc """
  Returns one selected source breakdown dimension.
  """
  @spec trend_sources(Community.t(), map(), source_dimension()) :: {:ok, map()}
  def trend_sources(%Community{} = community, args, dimension)
      when dimension in @source_dimensions do
    trend_items(community, args, :sources, fn community_analysis, range ->
      provider().sources(community_analysis, range, dimension)
    end)
  end

  @doc """
  Returns one selected environment breakdown dimension.
  """
  @spec trend_environment(Community.t(), map(), environment_dimension()) :: {:ok, map()}
  def trend_environment(%Community{} = community, args, dimension)
      when dimension in @environment_dimensions do
    trend_items(community, args, :environment, fn community_analysis, range ->
      provider().environment(community_analysis, range, dimension)
    end)
  end

  @doc """
  Returns one selected location breakdown dimension.
  """
  @spec trend_location(Community.t(), map(), location_dimension()) :: {:ok, map()}
  def trend_location(%Community{} = community, args, dimension)
      when dimension in @location_dimensions do
    trend_items(community, args, :location, fn community_analysis, range ->
      provider().location(community_analysis, range, dimension)
    end)
  end

  @doc "Returns the public, fixed-window visitor distribution for the About page."
  @spec visitor_location_map(Community.t()) :: {:ok, map()}
  def visitor_location_map(%Community{} = community) do
    range = resolve_range(%{days: @visitor_location_days})

    with {:ok, dashboard} <- dashboard_for(community) do
      if visitor_location_map_enabled?(dashboard) do
        load_visitor_location_map(community, dashboard, range)
      else
        {:ok, %{status: "ok", range: range, countries: [], error: nil}}
      end
    else
      {:error, reason} -> {:ok, unavailable_visitor_location_payload(range, reason)}
    end
  end

  @doc """
  Returns the UTC weekly traffic heatmap.
  """
  @spec trend_traffic(Community.t(), map()) :: {:ok, map()}
  def trend_traffic(%Community{} = community, args \\ %{}) do
    range = resolve_range(args)
    provider = provider()

    case prepare_community(community, provider) do
      {:ok, community_analysis} ->
        case provider.traffic(community_analysis, range) do
          {:ok, traffic} ->
            {:ok,
             %{
               status: "ok",
               timezone: Map.get(traffic, :timezone, "UTC"),
               cells: Map.get(traffic, :cells, []),
               error: nil
             }}

          {:error, reason} ->
            {:ok, unavailable_traffic_payload(reason)}
        end

      {:error, reason} ->
        {:ok, unavailable_traffic_payload(reason)}
    end
  end

  @spec tracking_website_id(Community.t()) :: {:ok, String.t() | nil}
  @doc "Runs `tracking_website_id` through the public `Web` boundary."
  def tracking_website_id(%Community{} = community) do
    case dashboard_for(community) do
      {:ok, dashboard} -> {:ok, dashboard.umami_website_id}
      {:error, _reason} -> {:ok, nil}
    end
  end

  @doc """
  Ensures a persisted community has its provider website identity.

  Community creation invokes this once its local records are ready. Query
  paths also call the same idempotent preparation flow, so a transient provider
  outage can recover without creating a duplicate website.
  """
  @spec provision_community(Community.t()) :: {:ok, String.t()} | {:error, term()}
  def provision_community(%Community{} = community) do
    with {:ok, community_analysis} <- prepare_community(community, provider()) do
      {:ok, community_analysis.umami_website_id}
    end
  end

  defp trend_items(community, args, section, query) do
    range = resolve_range(args)
    provider = provider()

    case prepare_community(community, provider) do
      {:ok, community_analysis} ->
        case query.(community_analysis, range) do
          {:ok, items} -> {:ok, %{status: "ok", items: items, error: nil}}
          {:error, reason} -> {:ok, unavailable_items_payload(section, reason)}
        end

      {:error, reason} ->
        {:ok, unavailable_items_payload(section, reason)}
    end
  end

  defp provider, do: @config.provider

  defp load_visitor_location_map(community, dashboard, range) do
    provider = provider()

    with :ok <- ensure_runtime_configured(),
         website_id when is_binary(website_id) <- dashboard.umami_website_id do
      community_analysis = AnalysisCommunity.from_community(community, website_id)
      key = "analysis.visitor_location_map.#{website_id}"

      case cached_visitor_locations(key, fn ->
             provider.visitor_locations(community_analysis, range)
           end) do
        {:ok, payload} -> {:ok, visitor_location_payload(payload, range)}
        {:error, reason} -> {:ok, unavailable_visitor_location_payload(range, reason)}
      end
    else
      nil -> {:ok, unavailable_visitor_location_payload(range, ErrorCat.not_configured())}
      {:error, reason} -> {:ok, unavailable_visitor_location_payload(range, reason)}
    end
  end

  defp cached_visitor_locations(key, loader) do
    result =
      Cache.get_or_fetch(:common, key, [expire_sec: @visitor_location_error_cache_seconds], fn ->
        {:ok, loader.()}
      end)

    case result do
      {:ok, {:ok, payload}} ->
        Cache.put(:common, key, {:ok, payload}, expire_sec: @visitor_location_cache_seconds)
        {:ok, payload}

      {:ok, {:error, reason}} ->
        {:error, reason}

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp visitor_location_map_enabled?(%CommunityDashboard{enable: enable}) do
    not is_nil(enable) and enable.about == true and enable.visitor_location_map == true
  end

  defp visitor_location_payload(payload, range) do
    countries =
      visitor_countries(Map.get(payload, :countries, []), Map.get(payload, :regions, []))

    region_error = Map.get(payload, :region_error)

    %{
      status: "ok",
      range: range,
      countries: countries,
      error: if(region_error, do: error_payload(region_error, "region"), else: nil)
    }
  end

  @doc """
  Normalizes provider country and region rows into the public visitor payload.

  Provider location rows -> bounded country payload -> Dashboard DTO.
  """
  def visitor_countries(country_rows, region_rows) do
    countries =
      country_rows
      |> Enum.filter(fn row ->
        String.match?(Map.get(row, :code, ""), ~r/^[A-Z]{2}$/) and
          Map.get(row, :visitors, 0) > 0
      end)
      |> Enum.group_by(& &1.code, & &1.visitors)
      |> Enum.map(fn {code, visitors} -> %{code: code, visitors: Enum.sum(visitors)} end)

    total_visitors = Enum.sum(Enum.map(countries, & &1.visitors))
    top_countries = countries |> Enum.sort_by(& &1.visitors, :desc) |> Enum.take(5)
    top_visitors = Enum.sum(Enum.map(top_countries, & &1.visitors))

    displayed =
      Enum.map(top_countries, fn country ->
        Map.merge(country, %{
          percentage: percentage_of(country.visitors, total_visitors),
          regions: visitor_regions(region_rows, country.code)
        })
      end)

    other_visitors = max(total_visitors - top_visitors, 0)

    if other_visitors > 0 do
      displayed_percentage = Enum.sum(Enum.map(displayed, & &1.percentage))
      other_percentage = Float.round(100.0 - displayed_percentage, 1)

      displayed =
        if other_percentage < 0,
          do: adjust_last_percentage(displayed, other_percentage),
          else: displayed

      displayed ++
        [
          %{
            code: "OTHER",
            visitors: other_visitors,
            percentage: max(other_percentage, 0.0),
            regions: []
          }
        ]
    else
      adjust_last_percentage(
        displayed,
        Float.round(100.0 - Enum.sum(Enum.map(displayed, & &1.percentage)), 1)
      )
    end
  end

  defp adjust_last_percentage([], _adjustment), do: []

  defp adjust_last_percentage(rows, adjustment) do
    List.update_at(rows, -1, fn row ->
      Map.update!(row, :percentage, &Float.round(&1 + adjustment, 1))
    end)
  end

  defp visitor_regions(_rows, country_code) when country_code not in @visitor_region_countries,
    do: []

  defp visitor_regions(rows, country_code) do
    rows
    |> Enum.filter(&(&1.country_code == country_code and &1.visitors > 0))
    |> Enum.group_by(& &1.code, & &1.visitors)
    |> Enum.map(fn {code, visitors} -> %{code: code, visitors: Enum.sum(visitors)} end)
    |> Enum.sort_by(& &1.visitors, :desc)
    |> Enum.take(@visitor_region_limit)
  end

  defp percentage_of(_value, 0), do: 0.0
  defp percentage_of(value, total), do: Float.round(value / total * 100, 1)

  defp prepare_community(%Community{} = community, provider) do
    with :ok <- ensure_runtime_configured(),
         :ok <- ensure_persisted_community(community),
         {:ok, dashboard} <- dashboard_for(community),
         {:ok, website_id} <- ensure_umami_website_id(community, dashboard, provider) do
      {:ok, AnalysisCommunity.from_community(community, website_id)}
    end
  end

  defp dashboard_for(%Community{} = community), do: Writer.ensure_exist(community)

  defp ensure_runtime_configured do
    case Config.runtime().api_token do
      token when is_binary(token) and token != "" -> :ok
      _ -> {:error, ErrorCat.not_configured()}
    end
  end

  defp ensure_persisted_community(%Community{id: id}) when is_integer(id), do: :ok
  defp ensure_persisted_community(%Community{}), do: {:error, ErrorCat.community_not_persisted()}

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
       when is_binary(website_id),
       do: {:ok, website_id}

  defp reload_dashboard(%CommunityDashboard{id: id}) do
    case Repo.get(CommunityDashboard, id) do
      %CommunityDashboard{} = dashboard -> {:ok, dashboard}
      nil -> {:error, ErrorCat.dashboard_not_found()}
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

  defp resolve_range(args) do
    days = args |> Map.get(:days, @config.default_days) |> clamp_days()
    end_at = DateTime.utc_now() |> DateTime.to_unix(:millisecond)

    %{
      days: days,
      start_at: end_at - days * 24 * 60 * 60 * 1000,
      end_at: end_at,
      bucket: bucket(days)
    }
  end

  defp clamp_days(days) when is_integer(days), do: days |> max(1) |> min(@config.max_days)
  defp clamp_days(_days), do: @config.default_days
  defp bucket(days) when days <= 2, do: "hour"
  defp bucket(_days), do: "day"

  defp ready_summary_payload(payload, scope, range) do
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

  defp unavailable_summary_payload(scope, range, reason) do
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

  defp trends_overview_payload(payload, range) do
    errors = Map.get(payload, :errors, [])
    summary = Map.get(payload, :summary, empty_summary())
    previous_summary = Map.get(payload, :previous_summary, empty_summary())

    %{
      status: overview_status(errors),
      provider: "umami",
      range: range,
      summary: overview_summary(summary, previous_summary),
      chart: %{bucket: range.bucket, points: Map.get(payload, :chart, [])},
      errors:
        Enum.map(errors, fn {section, reason} ->
          error_payload(reason, Atom.to_string(section))
        end)
    }
  end

  defp unavailable_overview_payload(range, reason) do
    %{
      status: "unavailable",
      provider: "umami",
      range: range,
      summary: overview_summary(empty_summary(), empty_summary()),
      chart: %{bucket: range.bucket, points: []},
      errors: [error_payload(reason, "overview")]
    }
  end

  defp unavailable_items_payload(section, reason) do
    %{status: "unavailable", items: [], error: error_payload(reason, Atom.to_string(section))}
  end

  defp unavailable_traffic_payload(reason) do
    %{status: "unavailable", timezone: "UTC", cells: [], error: error_payload(reason, "traffic")}
  end

  defp unavailable_visitor_location_payload(range, reason) do
    %{
      status: "unavailable",
      range: range,
      countries: [],
      error: error_payload(reason, "country")
    }
  end

  defp overview_status([]), do: "ok"

  defp overview_status(errors) do
    sections = errors |> Enum.map(&elem(&1, 0)) |> MapSet.new()

    if MapSet.equal?(sections, MapSet.new([:summary, :chart])), do: "unavailable", else: "partial"
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

  defp metric(value, previous_value),
    do: %{
      value: value,
      previous_value: previous_value,
      change_rate: change_rate(value, previous_value)
    }

  defp change_rate(_value, previous_value) when previous_value in [0, 0.0], do: nil

  defp change_rate(value, previous_value),
    do: Float.round((value - previous_value) / previous_value * 100, 2)

  defp rate(_value, 0), do: 0.0
  defp rate(value, total), do: Float.round(value / total, 2)

  defp empty_summary, do: %{pageviews: 0, visitors: 0, visits: 0, bounces: 0, total_time: 0}

  defp error_payload(reason, section) do
    reason = error_reason(reason)

    %{
      code: error_code(reason),
      message: error_message(reason),
      section: section,
      provider_status: provider_status(reason)
    }
  end

  defp error_reason(%GroupherServer.ErrorCat.Error{reason: reason}), do: reason
  defp error_reason(reason), do: reason

  defp error_code(:not_configured), do: "not_configured"
  defp error_code({:http_error, _status}), do: "provider_http_error"
  defp error_code(:timeout), do: "provider_timeout"
  defp error_code(_reason), do: "provider_error"
  defp provider_status({:http_error, status}), do: Integer.to_string(status)
  defp provider_status(_reason), do: nil
  defp error_message(:not_configured), do: "web analysis is not configured"
  defp error_message({:http_error, status}), do: "umami returned HTTP #{status}"
  defp error_message(:timeout), do: "umami analysis request timed out"
  defp error_message(reason), do: inspect(reason)
end
