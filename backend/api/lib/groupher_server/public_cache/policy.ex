defmodule GroupherServer.PublicCache.Policy do
  @moduledoc """
  Runtime policy for bounded Cloudflare purge delivery.

  Business position:

      purge delivery -> Policy -> timeout, retry, and tag-count bounds
  """

  @defaults [
    timeout_ms: 5_000,
    max_attempts: 8,
    retry_base_delay_seconds: 1,
    max_retry_delay_seconds: 60,
    max_tags_per_request: 100,
    delivery_lease_seconds: 120,
    pending_slo_seconds: 600
  ]

  def timeout_ms, do: value(:timeout_ms)
  def max_attempts, do: value(:max_attempts)
  def retry_base_delay_seconds, do: value(:retry_base_delay_seconds)
  def max_retry_delay_seconds, do: value(:max_retry_delay_seconds)
  def max_tags_per_request, do: value(:max_tags_per_request)
  def delivery_lease_seconds, do: value(:delivery_lease_seconds)
  def pending_slo_seconds, do: value(:pending_slo_seconds)

  defp value(key) do
    Application.get_env(:groupher_server, __MODULE__, @defaults)
    |> Keyword.get(key, Keyword.fetch!(@defaults, key))
  end
end
