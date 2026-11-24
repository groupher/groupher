defmodule Helper.Guardian.BrowserAccess do
  @moduledoc """
  Guardian implementation for the Auth V1 browser access credential.

  This module owns the browser-only issuer, audience, token type, Session claim,
  and 30-minute lifetime. Legacy bearer credentials remain under
  `Helper.Guardian` so the two protocols cannot inherit each other's claims.

  Business position:

      Domain or web caller
        -> BrowserAccess
        -> normalized value / infrastructure
  """

  use Guardian, otp_app: :groupher_server

  alias GroupherServer.{Accounts, Auth}
  alias Accounts.Profiles.ErrorCat

  @access_ttl_seconds 30 * 60

  @doc "Uses the resource id as the string subject for a signed token."
  @impl true
  def subject_for_token(resource, _claims), do: {:ok, to_string(resource.id)}

  @doc "Returns an id-only resource from the subject claim without looking up an account."
  @impl true
  def resource_from_claims(claims), do: {:ok, %{id: claims["sub"]}}

  @doc "Issues a bounded browser API token tied to one persisted Browser Session."
  def encode(source, browser_session_ref, session_absolute_expires_at, now \\ DateTime.utc_now()) do
    remaining = max(DateTime.diff(session_absolute_expires_at, now, :second), 0)
    ttl = min(@access_ttl_seconds, remaining)

    if ttl <= 0 do
      {:error, ErrorCat.session_expired()}
    else
      encode_and_sign(
        source,
        %{
          "aud" => Auth.phoenix_token_audience(),
          "sid" => browser_session_ref,
          "typ" => Auth.phoenix_token_type()
        },
        ttl: {ttl, :seconds}
      )
    end
  end

  @doc "Verifies the complete browser credential contract and returns its raw claims."
  def decode_claims(token) when is_binary(token) do
    with {:ok, claims} <- decode_and_verify(token),
         true <- valid_claims?(claims) do
      {:ok, claims}
    else
      false -> {:error, ErrorCat.invalid_browser_access_claims()}
      error -> error
    end
  end

  @doc "Checks the browser issuer, audience, token type and non-empty binary session id; does not verify a signature."
  def valid_claims?(claims) do
    claims["iss"] == Auth.phoenix_token_issuer() and
      claims["aud"] == Auth.phoenix_token_audience() and
      claims["typ"] == Auth.phoenix_token_type() and is_binary(claims["sid"]) and
      claims["sid"] != ""
  end

  @doc "Returns the earlier of the 30-minute access deadline and the session deadline, using second precision for the remaining lifetime."
  def expires_at(session_absolute_expires_at, now \\ DateTime.utc_now()) do
    DateTime.add(
      now,
      min(@access_ttl_seconds, DateTime.diff(session_absolute_expires_at, now, :second)),
      :second
    )
  end
end
