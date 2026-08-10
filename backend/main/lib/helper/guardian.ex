defmodule Helper.Guardian do
  @moduledoc """
  This module defines some helper function used by
  encode/decode jwt
  NOTE:  You can use `mix guardian.gen.secret` to get one
  see: https://github.com/ueberauth/guardian
  """
  use Guardian, otp_app: :groupher_server

  @token_expiration 24 * 30
  @browser_access_ttl_seconds 30 * 60
  @browser_issuer "groupher:phoenix"
  @browser_audience "phoenix:browser-api"

  @spec subject_for_token(atom | %{id: any}, any) :: {:ok, binary}
  def subject_for_token(resource, _claims) do
    {:ok, to_string(resource.id)}
  end

  @spec resource_from_claims(nil | keyword | map) :: {:ok, %{id: any}}
  def resource_from_claims(claims) do
    {:ok, %{id: claims["sub"]}}
  end

  @spec jwt_encode(any, map) :: {:error, any} | {:ok, binary, map}
  def jwt_encode(source, args \\ %{}) do
    encode_and_sign(source, args, ttl: {@token_expiration, :hour})
  end

  @doc "Issues a bounded browser API token tied to one persisted Browser Session."
  def jwt_encode_browser(
        source,
        browser_session_ref,
        session_absolute_expires_at,
        now \\ DateTime.utc_now()
      ) do
    remaining = max(DateTime.diff(session_absolute_expires_at, now, :second), 0)
    ttl = min(@browser_access_ttl_seconds, remaining)

    if ttl <= 0 do
      {:error, :session_expired}
    else
      encode_and_sign(
        source,
        %{
          "aud" => @browser_audience,
          "iss" => @browser_issuer,
          "sid" => browser_session_ref,
          "typ" => "browser_access"
        },
        ttl: {ttl, :seconds}
      )
    end
  end

  def browser_access_expires_at(session_absolute_expires_at, now \\ DateTime.utc_now()) do
    DateTime.add(
      now,
      min(@browser_access_ttl_seconds, DateTime.diff(session_absolute_expires_at, now, :second)),
      :second
    )
  end

  def valid_browser_access_claims?(claims) do
    claims["iss"] == @browser_issuer and claims["aud"] == @browser_audience and
      claims["typ"] == "browser_access" and is_binary(claims["sid"]) and claims["sid"] != ""
  end

  # jwt_decode
  @spec jwt_decode(binary) :: {:error, any} | {:ok, any, map}
  def jwt_decode(token) do
    resource_from_token(token)
  end
end
