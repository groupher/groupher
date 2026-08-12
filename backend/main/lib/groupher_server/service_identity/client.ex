defmodule GroupherServer.ServiceIdentity.Client do
  @moduledoc "Fetches and caches short-lived Auth service tokens for Phoenix."

  @cache_table :groupher_service_token_cache
  @refresh_skew_seconds 30

  def token(resource, scopes) do
    ensure_cache_table()
    key = {resource, Enum.sort(scopes)}
    now = System.system_time(:second)

    case :ets.lookup(@cache_table, key) do
      [{^key, token, expires_at}] when expires_at - @refresh_skew_seconds > now ->
        {:ok, token}

      _ ->
        :global.trans({__MODULE__, key}, fn ->
          refreshed_now = System.system_time(:second)

          case :ets.lookup(@cache_table, key) do
            [{^key, token, expires_at}]
            when expires_at - @refresh_skew_seconds > refreshed_now ->
              {:ok, token}

            _ ->
              acquire(key, resource, scopes, refreshed_now)
          end
        end)
    end
  end

  defp acquire(key, resource, scopes, now) do
    config = Application.get_env(:groupher_server, __MODULE__, [])
    endpoint = Keyword.get(config, :token_endpoint)
    client_id = Keyword.get(config, :client_id)
    client_secret = Keyword.get(config, :client_secret)

    with true <- Enum.all?([endpoint, client_id, client_secret], &(is_binary(&1) and &1 != "")),
         basic <- Base.encode64("#{client_id}:#{client_secret}"),
         {:ok, %{status: 200, body: body}} <-
           Req.post(endpoint,
             body:
               URI.encode_query(%{
                 "grant_type" => "client_credentials",
                 "resource" => resource,
                 "scope" => Enum.join(scopes, " ")
               }),
             headers: [
               {"authorization", "Basic #{basic}"},
               {"content-type", "application/x-www-form-urlencoded"}
             ],
             receive_timeout: 5_000,
             retry: false
           ),
         %{"access_token" => token, "expires_in" => expires_in, "token_type" => "Bearer"} <- body,
         true <- is_binary(token) and is_integer(expires_in) do
      :ets.insert(@cache_table, {key, token, now + expires_in})
      {:ok, token}
    else
      _ -> {:error, :service_token_unavailable}
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
end
