defmodule GroupherServerWeb.ServiceIdentity do
  @moduledoc """
  Verifies Auth-issued service access JWTs locally from a bounded JWKS cache.
  """

  @cache_table :groupher_service_identity_jwks
  @cache_ttl_ms :timer.minutes(5)
  @clock_skew_seconds 30
  @max_token_ttl_seconds 15 * 60

  @spec service_token?(String.t()) :: boolean()
  def service_token?(token) when is_binary(token) do
    with [protected, _payload, _signature] <- String.split(token, "."),
         {:ok, json} <- Base.url_decode64(protected, padding: false),
         {:ok, %{"typ" => "service_access+jwt"}} <- Jason.decode(json) do
      true
    else
      _ -> false
    end
  end

  @spec verify(String.t()) :: {:ok, map()} | {:error, atom()}
  def verify(token) when is_binary(token) do
    with {:ok, header} <- protected_header(token),
         "service_access+jwt" <- header["typ"],
         "RS256" <- header["alg"],
         kid when is_binary(kid) <- header["kid"],
         {:ok, jwk} <- signing_key(kid),
         {true, %JOSE.JWT{fields: claims}, _jws} <- JOSE.JWT.verify_strict(jwk, ["RS256"], token),
         :ok <- validate_claims(claims) do
      {:ok,
       %{
         audience: claims["aud"],
         scopes: claims["scope"] |> String.split(" ", trim: true) |> MapSet.new(),
         subject: claims["sub"],
         token_id: claims["jti"]
       }}
    else
      _ -> {:error, :invalid_service_token}
    end
  end

  defp protected_header(token) do
    with [protected, _payload, _signature] <- String.split(token, "."),
         {:ok, json} <- Base.url_decode64(protected, padding: false),
         {:ok, header} <- Jason.decode(json) do
      {:ok, header}
    else
      _ -> {:error, :malformed_token}
    end
  end

  defp signing_key(kid) do
    with {:ok, keys} <- jwks(false),
         nil <- Enum.find(keys, &(&1["kid"] == kid)),
         {:ok, refreshed} <- jwks(true),
         key when is_map(key) <- Enum.find(refreshed, &(&1["kid"] == kid)) do
      {:ok, JOSE.JWK.from_map(key)}
    else
      key when is_map(key) -> {:ok, JOSE.JWK.from_map(key)}
      _ -> {:error, :unknown_kid}
    end
  end

  defp jwks(force_refresh) do
    config = Application.get_env(:groupher_server, __MODULE__, [])

    case Keyword.get(config, :jwks) do
      %{"keys" => keys} when is_list(keys) -> {:ok, keys}
      _ -> cached_remote_jwks(Keyword.get(config, :jwks_url), force_refresh)
    end
  end

  defp cached_remote_jwks(url, force_refresh) when is_binary(url) and url != "" do
    ensure_cache_table()
    now = System.monotonic_time(:millisecond)

    case :ets.lookup(@cache_table, :keys) do
      [{:keys, keys, expires_at}] when not force_refresh and expires_at > now -> {:ok, keys}
      _ -> fetch_jwks(url, now)
    end
  end

  defp cached_remote_jwks(_, _), do: {:error, :jwks_unavailable}

  defp fetch_jwks(url, now) do
    case Req.get(url, receive_timeout: 3_000, retry: false) do
      {:ok, %{status: 200, body: %{"keys" => keys}}} when is_list(keys) ->
        :ets.insert(@cache_table, {:keys, keys, now + @cache_ttl_ms})
        {:ok, keys}

      _ ->
        {:error, :jwks_unavailable}
    end
  end

  defp ensure_cache_table do
    case :ets.whereis(@cache_table) do
      :undefined ->
        try do
          :ets.new(@cache_table, [:named_table, :public, read_concurrency: true])
        rescue
          ArgumentError -> @cache_table
        end

      table ->
        table
    end
  end

  defp validate_claims(claims) do
    config = Application.get_env(:groupher_server, __MODULE__, [])
    now = DateTime.utc_now() |> DateTime.to_unix()
    issuer = Keyword.get(config, :issuer)
    audiences = Keyword.get(config, :audiences, [])

    valid =
      claims["iss"] == issuer and claims["aud"] in audiences and
        is_binary(claims["sub"]) and String.starts_with?(claims["sub"], "service:") and
        is_binary(claims["scope"]) and is_binary(claims["jti"]) and
        is_integer(claims["iat"]) and is_integer(claims["nbf"]) and is_integer(claims["exp"]) and
        claims["iat"] <= now + @clock_skew_seconds and claims["nbf"] <= now + @clock_skew_seconds and
        claims["exp"] >= now - @clock_skew_seconds and
        claims["exp"] - claims["iat"] <= @max_token_ttl_seconds

    if valid, do: :ok, else: {:error, :invalid_claims}
  end
end
