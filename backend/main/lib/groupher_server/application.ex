defmodule GroupherServer.Application do
  @moduledoc false
  use Application
  import Helper.Utils, only: [get_config: 2]

  alias Helper.Cache

  @cache_pool get_config(:cache, :pool)

  # See https://hexdocs.pm/elixir/Application.html
  # for more information on OTP Applications
  @spec start(any, any) :: {:error, any} | {:ok, pid}
  def start(_type, _args) do
    # Define workers and child supervisors to be supervised
    children = [
      {DNSCluster, query: Application.get_env(:groupher_server, :dns_cluster_query) || :ignore},
      # Start the PubSub system
      {Phoenix.PubSub, name: MyApp.PubSub},
      # Start the Ecto repository
      GroupherServer.Repo,
      # Start the endpoint when the application starts
      GroupherServerWeb.Endpoint
      # Start your own worker by calling: GroupherServer.Worker.start_link(arg1, arg2, arg3)
      # worker(Helper.Scheduler, []),
    ] ++ maybe_rihanna_worker() ++ cache_workers()

    # See https://hexdocs.pm/elixir/Supervisor.html
    # for other strategies and supported options
    opts = [strategy: :one_for_one, name: GroupherServer.Supervisor]
    Supervisor.start_link(children, opts)
  end

  # Tell Phoenix to update the endpoint configuration
  # whenever the application is updated.
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

  defp maybe_rihanna_worker do
    if test_env?() do
      []
    else
      [{Rihanna.Supervisor, [postgrex: GroupherServer.Repo.config()]}]
    end
  end

  defp test_env?, do: Application.get_env(:groupher_server, :env) == :test
end
