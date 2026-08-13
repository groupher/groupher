defmodule Helper.Guardian do
  @moduledoc """
  Guardian implementation for Groupher's legacy long-lived access credential.

  It deliberately validates the legacy issuer, audience, and token type. Auth
  V1 browser access tokens use `Helper.Guardian.BrowserAccess` and must not
  inherit this 30-day credential contract.

  Business position:

      Domain or web caller
        -> Guardian
        -> normalized value / infrastructure
  """
  use Guardian, otp_app: :groupher_server

  @token_expiration 24 * 30
  @legacy_issuer "groupher_server"
  @spec subject_for_token(atom | %{id: any}, any) :: {:ok, binary}
  @impl true
  def subject_for_token(resource, _claims) do
    {:ok, to_string(resource.id)}
  end

  @spec resource_from_claims(nil | keyword | map) :: {:ok, %{id: any}}
  @impl true
  def resource_from_claims(claims) do
    {:ok, %{id: claims["sub"]}}
  end

  @spec jwt_encode(any, map) :: {:error, any} | {:ok, binary, map}
  @doc "Encodes a legacy Groupher access token."
  def jwt_encode(source, args \\ %{}) do
    encode_and_sign(source, args, ttl: {@token_expiration, :hour})
  end

  # jwt_decode
  @spec jwt_decode(binary) :: {:error, any} | {:ok, any, map}
  @doc "Decodes a token only when its legacy access claims match this boundary."
  def jwt_decode(token) do
    with {:ok, claims} <- decode_and_verify(token),
         true <- valid_legacy_claims?(claims),
         {:ok, resource} <- resource_from_claims(claims) do
      {:ok, resource, claims}
    else
      false -> {:error, :invalid_legacy_access_claims}
      error -> error
    end
  end

  defp valid_legacy_claims?(claims) do
    claims["iss"] == @legacy_issuer and claims["aud"] == @legacy_issuer and
      claims["typ"] == "access"
  end
end
