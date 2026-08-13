defmodule GroupherServer.CMS.Assets.Capability do
  @moduledoc """
  Shared signing contract for browser-to-Assets-Hub upload capabilities.

  Business position:

      Dashboard / editor
        -> CMS.Assets
        -> Capability
        -> Repo / Assets Hub
  """

  @spec sign(map()) :: String.t()
  def sign(payload) when is_map(payload) do
    encoded = payload |> Jason.encode!() |> Base.url_encode64(padding: false)
    signature = :crypto.mac(:hmac, :sha256, secret(), encoded)
    encoded <> "." <> Base.url_encode64(signature, padding: false)
  end

  @spec public_endpoint() :: String.t()
  def public_endpoint do
    System.get_env("ASSETS_PUBLIC_ENDPOINT") || "https://assets.groupher.com"
  end

  defp secret do
    System.get_env("ASSETS_HUB_CAPABILITY_SECRET") ||
      Application.get_env(:groupher_server, :assets_hub, [])[:capability_secret] ||
      raise "ASSETS_HUB_CAPABILITY_SECRET is required"
  end
end
