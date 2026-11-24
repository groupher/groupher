defmodule GroupherServer.CMS.Assets.Capability do
  @moduledoc """
  Shared signing contract for browser-to-Assets-Hub upload capabilities.

  Business position:

      Dashboard / editor
        -> CMS.Assets
        -> Capability
        -> Repo / Assets Hub
  """

  @doc """
  Signs an upload capability payload for assets-hub verification.

  The payload is HMAC-SHA256 signed with the shared capability secret.

  ## Examples

      Capability.sign(%{"purpose" => "asset.upload", "uploadRef" => "upload_abc"})

  """
  @spec sign(map()) :: String.t()
  def sign(payload) when is_map(payload) do
    encoded = payload |> Jason.encode!() |> Base.url_encode64(padding: false)
    signature = :crypto.mac(:hmac, :sha256, secret(), encoded)
    encoded <> "." <> Base.url_encode64(signature, padding: false)
  end

  @doc "Returns the configured public asset endpoint used to construct canonical URLs."
  @spec public_endpoint() :: String.t()
  def public_endpoint do
    GroupherServer.CMS.Assets.Endpoints.fetch!("ASSETS_PUBLIC_ENDPOINT")
  end

  @doc "Verifies and decodes a capability signed by the shared Assets Hub secret."
  @spec verify(String.t()) :: {:ok, map()} | {:error, atom()}
  def verify(token) when is_binary(token) do
    with [encoded, signature] <- String.split(token, ".", parts: 2),
         {:ok, payload} <- Base.url_decode64(encoded, padding: false),
         {:ok, actual_signature} <- Base.url_decode64(signature, padding: false),
         true <- secure_compare(actual_signature, :crypto.mac(:hmac, :sha256, secret(), encoded)),
         {:ok, decoded} when is_map(decoded) <- Jason.decode(payload) do
      {:ok, decoded}
    else
      _ -> {:error, :invalid_capability}
    end
  rescue
    _ -> {:error, :invalid_capability}
  end

  defp secure_compare(left, right) when byte_size(left) == byte_size(right) do
    Plug.Crypto.secure_compare(left, right)
  end

  defp secure_compare(_left, _right), do: false

  defp secret do
    System.get_env("ASSETS_HUB_CAPABILITY_SECRET") ||
      Application.get_env(:groupher_server, :assets_hub, [])[:capability_secret] ||
      raise "ASSETS_HUB_CAPABILITY_SECRET is required"
  end
end
