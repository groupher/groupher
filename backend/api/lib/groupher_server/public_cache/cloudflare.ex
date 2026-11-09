defmodule GroupherServer.PublicCache.Cloudflare do
  @moduledoc """
  Phoenix-owned Cloudflare cache-tag adapter.

  It calls `POST /client/v4/zones/{zone_id}/purge_cache` with
  `{"tags": [...]}` and accepts a purge only when both the HTTP response and
  Cloudflare's JSON `success` field indicate success. HTTP 200 alone only means
  Cloudflare accepted the request; it does not prove a cached object existed.

  For example, a successful call sends:

      POST https://api.cloudflare.com/client/v4/zones/$ZONE_ID/purge_cache
      Authorization: Bearer $CLOUDFLARE_API_TOKEN
      Content-Type: application/json

      {"tags":["community[home]-thread[POST]-article[42]"]}

  Cloudflare removes every cached object carrying that tag. It does not render
  the page, change ArticleStats, or guarantee that the next request has already
  reached origin; the next public GET performs the normal SSR/cache-fill path.
  See the [cache-tag API documentation](https://developers.cloudflare.com/api/resources/cache/methods/purge/)
  and [purge-by-tags guide](https://developers.cloudflare.com/cache/how-to/purge-cache/purge-by-tags/).

  Business position:

      PurgeWorker -> Phoenix adapter -> Cloudflare Cache API
  """

  alias GroupherServer.PublicCache
  alias PublicCache.{DeliveryConfig, Tags}

  @http_months ~w(Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec)

  @doc """
  Purges the supplied validated cache tags through Cloudflare.

  ## Examples

      PublicCache.Cloudflare.purge(["community[acme]"])
  """
  @spec purge([String.t()]) :: {:ok, :pass} | {:error, term()}
  def purge(tags) when is_list(tags) do
    with {:ok, tags} <- Tags.validate(tags),
         {:ok, config} <- config(),
         {:ok, response} <- request(config, tags),
         {:ok, _} <- response_success(response) do
      {:ok, :pass}
    end
  end

  defp config do
    config = Application.get_env(:groupher_server, __MODULE__, [])
    zone_id = Keyword.get(config, :zone_id) || System.get_env("CLOUDFLARE_ZONE_ID")
    token = Keyword.get(config, :api_token) || System.get_env("CLOUDFLARE_API_TOKEN")

    if is_binary(zone_id) and zone_id != "" and is_binary(token) and token != "" do
      {:ok,
       %{
         zone_id: zone_id,
         token: token,
         req_options: Keyword.get(config, :req_options, [])
       }}
    else
      {:error, :cloudflare_not_configured}
    end
  end

  @doc """
  Validates that the production purge adapter has its required credentials.

  ## Examples

      PublicCache.Cloudflare.configured?()
  """
  @spec configured?() :: boolean()
  def configured? do
    match?({:ok, _config}, config())
  end

  defp request(%{zone_id: zone_id, token: token, req_options: req_options}, tags) do
    Req.post(
      "https://api.cloudflare.com/client/v4/zones/#{zone_id}/purge_cache",
      Keyword.merge(req_options,
        json: %{tags: tags},
        headers: [{"authorization", "Bearer #{token}"}],
        receive_timeout: DeliveryConfig.timeout_ms(),
        retry: false
      )
    )
  end

  defp response_success(%{status: status, body: %{"success" => true}}) when status in 200..299 do
    {:ok, :pass}
  end

  defp response_success(%{status: status, body: %{success: true}}) when status in 200..299 do
    {:ok, :pass}
  end

  defp response_success(%{status: 429, headers: headers}) do
    case retry_after_seconds(headers) do
      seconds when is_integer(seconds) ->
        jitter = :rand.uniform(min(max(div(seconds, 4), 1), 5))
        {:error, {:cloudflare_rate_limited, min(seconds + jitter, 86_400)}}

      nil ->
        {:error, {:cloudflare_rejected, 429}}
    end
  end

  defp response_success(%{status: status}), do: {:error, {:cloudflare_rejected, status}}

  defp retry_after_seconds(headers) do
    headers
    |> Map.get("retry-after", [])
    |> List.wrap()
    |> List.first()
    |> parse_retry_after()
  end

  defp parse_retry_after(value) when is_binary(value) do
    case Integer.parse(String.trim(value)) do
      {seconds, ""} when seconds > 0 and seconds <= 86_400 -> seconds
      _ -> parse_retry_after_date(value)
    end
  end

  defp parse_retry_after(_value), do: nil

  defp parse_retry_after_date(value) do
    with [_, day, month, year, hour, minute, second] <-
           Regex.run(
             ~r/\A(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), (\d{2}) ([A-Z][a-z]{2}) (\d{4}) (\d{2}):(\d{2}):(\d{2}) GMT\z/,
             value
           ),
         month when is_integer(month) <- Enum.find_index(@http_months, &(&1 == month)),
         {day, ""} <- Integer.parse(day),
         {year, ""} <- Integer.parse(year),
         {hour, ""} <- Integer.parse(hour),
         {minute, ""} <- Integer.parse(minute),
         {second, ""} <- Integer.parse(second) do
      retry_at =
        :calendar.datetime_to_gregorian_seconds({{year, month + 1, day}, {hour, minute, second}})

      now = DateTime.utc_now() |> DateTime.to_naive() |> NaiveDateTime.to_erl()
      max(retry_at - :calendar.datetime_to_gregorian_seconds(now), 1)
    else
      _ -> nil
    end
  end
end
