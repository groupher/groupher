defmodule GroupherServer.CMS.Assets.Endpoints do
  @moduledoc """
  Validates the three distinct Assets Hub network boundaries.

  Public reads, generated Batch operations, and provider deletion deliberately
  use separate environment keys. Missing configuration must never redirect an
  internal write to a public or production host.

      application startup / Assets capability / generated Batch / deletion
        -> role-specific environment key
        -> validated, normalized HTTP endpoint
  """

  @required_keys ~w(ASSETS_PUBLIC_ENDPOINT ASSETS_HUB_BATCH_ENDPOINT ASSETS_HUB_DELETE_ENDPOINT)

  @doc "Returns one normalized endpoint without consulting another endpoint role."
  @spec fetch(String.t(), map()) :: {:ok, String.t()} | :error
  def fetch(key, env \\ System.get_env()) when is_binary(key) and is_map(env) do
    case Map.get(env, key) do
      value when is_binary(value) ->
        value
        |> String.trim()
        |> normalize_endpoint()

      _ ->
        :error
    end
  end

  @doc "Returns one normalized endpoint or raises with the exact missing key."
  @spec fetch!(String.t(), map()) :: String.t()
  def fetch!(key, env \\ System.get_env()) do
    case fetch(key, env) do
      {:ok, endpoint} -> endpoint
      :error -> raise ArgumentError, "#{key} is required"
    end
  end

  @doc "Fails application startup when an active Assets Hub boundary is unconfigured."
  @spec validate!(map(), atom()) :: :ok
  def validate!(env \\ System.get_env(), app_env \\ Application.get_env(:groupher_server, :env)) do
    if app_env != :prod do
      :ok
    else
      missing = Enum.reject(@required_keys, &match?({:ok, _}, fetch(&1, env)))

      if missing == [] do
        :ok
      else
        raise ArgumentError, "missing Assets Hub endpoints: #{Enum.join(missing, ", ")}"
      end
    end
  end

  defp normalize_endpoint(endpoint) do
    uri = URI.parse(endpoint)

    if uri.scheme in ["http", "https"] and is_binary(uri.host) and uri.host != "" do
      {:ok, String.trim_trailing(endpoint, "/")}
    else
      :error
    end
  end
end
