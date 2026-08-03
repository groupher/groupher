defmodule GroupherServer.Analysis do
  @moduledoc """
  Platform analysis context.

  This context owns Groupher's built-in traffic analysis surface. The initial
  implementation is web-only by product decision, so web is the default scope
  instead of another nested context name.
  """

  alias __MODULE__.Community, as: AnalysisCommunity
  alias GroupherServer.CMS.Model.Community
  alias __MODULE__.Provider.Umami

  @default_days 7

  @spec summary(Community.t(), map()) :: {:ok, map()}
  def summary(%Community{} = community, args \\ %{}) do
    community_analysis = AnalysisCommunity.from_community(community)
    range = resolve_range(args)
    config = config()
    provider = Map.get(config, :provider, Umami)

    case provider.summary(config, community_analysis, range) do
      {:ok, payload} -> {:ok, ready_payload(payload, community_analysis, range)}
      {:error, reason} -> {:ok, unavailable_payload(community_analysis, range, reason)}
    end
  end

  defp config do
    :groupher_server
    |> Application.get_env(:web_analysis, [])
    |> Enum.into(%{})
  end

  defp resolve_range(args) do
    days = args |> Map.get(:days, @default_days) |> clamp_days()
    end_at = DateTime.utc_now() |> DateTime.to_unix(:millisecond)
    start_at = end_at - days * 24 * 60 * 60 * 1000

    %{days: days, start_at: start_at, end_at: end_at}
  end

  defp clamp_days(days) when is_integer(days), do: days |> max(1) |> min(90)
  defp clamp_days(_), do: @default_days

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

  defp empty_summary do
    %{pageviews: 0, visitors: 0, visits: 0, bounces: 0, total_time: 0}
  end

  defp error_message(:not_configured), do: "web analysis is not configured"
  defp error_message({:http_error, status}), do: "umami returned HTTP #{status}"
  defp error_message(reason), do: inspect(reason)
end
