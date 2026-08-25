defmodule GroupherServer.Application do
  @moduledoc """
  OTP application entrypoint for the Groupher backend.

  It assembles runtime workers for Phoenix, Repo, PubSub, DNS clustering,
  Oban jobs, and Cachex pools. Seed environments skip DNS, endpoint,
  Cachex, and Oban workers; test environments only skip Oban-backed jobs.

  Business position:

      BEAM runtime
        -> GroupherServer.Application
        -> Repo + PubSub + Endpoint + Finch + Oban + Cachex
        -> GraphQL/domain/background execution
  """
  use Application

  alias Helper.Cache

  @cache_pool Helper.Cache.Config.pool()

  # See https://hexdocs.pm/elixir/Application.html
  # for more information on OTP Applications
  @spec start(any, any) :: {:error, any} | {:ok, pid}
  @doc "Starts the environment-appropriate Groupher supervision tree."
  def start(_type, _args) do
    children =
      [
        {Phoenix.PubSub, name: GroupherServer.PubSub},
        GroupherServer.Repo
      ] ++
        maybe_dns_cluster_worker() ++
        maybe_endpoint_worker() ++
        maybe_finch_worker() ++ maybe_oban_worker() ++ maybe_cache_workers()

    # See https://hexdocs.pm/elixir/Supervisor.html
    # for other strategies and supported options
    opts = [strategy: :one_for_one, name: GroupherServer.Supervisor]
    Supervisor.start_link(children, opts)
  end

  # Tell Phoenix to update the endpoint configuration
  # whenever the application is updated.
  @doc "Forwards release-time configuration changes to the Phoenix endpoint."
  def config_change(changed, _new, removed) do
    GroupherServerWeb.Endpoint.config_change(changed, removed)
    :ok
  end

  defp cache_workers do
    @cache_pool
    |> Map.keys()
    |> Enum.reduce([], fn key, acc ->
      name = @cache_pool[key].name
      acc ++ [%{id: name, start: {Cachex, :start_link, [name, Cache.config(key)]}}]
    end)
  end

  defp maybe_dns_cluster_worker do
    if seed_env?() do
      []
    else
      [{DNSCluster, query: Application.get_env(:groupher_server, :dns_cluster_query) || :ignore}]
    end
  end

  defp maybe_endpoint_worker do
    if seed_env?(), do: [], else: [GroupherServerWeb.Endpoint]
  end

  defp maybe_cache_workers do
    if seed_env?(), do: [], else: cache_workers()
  end

  defp maybe_finch_worker do
    if seed_env?(), do: [], else: [{Finch, name: GroupherServer.Finch}]
  end

  defp maybe_oban_worker do
    if test_env?() or seed_env?() do
      []
    else
      [{Oban, Application.fetch_env!(:groupher_server, Oban)}]
    end
  end

  defp test_env?, do: Application.get_env(:groupher_server, :env) == :test
  defp seed_env?, do: Application.get_env(:groupher_server, :env) == :seed_prod
end
