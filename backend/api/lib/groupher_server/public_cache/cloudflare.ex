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
  alias PublicCache.{Policy, Tags}

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
      {:ok, %{zone_id: zone_id, token: token}}
    else
      {:error, :cloudflare_not_configured}
    end
  end

  @doc "Validates that the production purge adapter has its required credentials."
  @spec configured?() :: boolean()
  def configured? do
    match?({:ok, _config}, config())
  end

  defp request(%{zone_id: zone_id, token: token}, tags) do
    Req.post(
      "https://api.cloudflare.com/client/v4/zones/#{zone_id}/purge_cache",
      json: %{tags: tags},
      headers: [{"authorization", "Bearer #{token}"}],
      receive_timeout: Policy.timeout_ms(),
      retry: false
    )
  end

  defp response_success(%{status: status, body: %{"success" => true}}) when status in 200..299 do
    {:ok, :pass}
  end

  defp response_success(%{status: status, body: %{success: true}}) when status in 200..299 do
    {:ok, :pass}
  end

  defp response_success(%{status: status}), do: {:error, {:cloudflare_rejected, status}}
end
