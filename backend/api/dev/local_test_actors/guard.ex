defmodule GroupherServer.LocalTestActors.Guard do
  @moduledoc """
  Admits only Hub-managed development processes connected to the local dev database.

      local socket + private Hub key -> environment/config -> actual DB identity

  This module is compiled from dev/, never into a production release.
  """
  alias GroupherServer.Repo

  @local_hosts ["localhost", "127.0.0.1", "::1"]
  @local_addresses ["127.0.0.1", "127.0.0.1/32", "::1", "::1/128", nil]

  def check_environment(environment, variables, config) do
    markers = ~w(NODE_ENV CLOUDFLARE_ENV ENVIRONMENT MIX_ENV)

    local_markers? =
      Enum.all?(markers, fn key ->
        value = variables |> Map.get(key, "") |> String.trim() |> String.downcase()
        value in ["", "dev", "development", "local"]
      end)

    if environment == :dev and local_markers? and variables["CI"] != "true" and
         variables["DEV_HUB_MANAGED_ENVIRONMENT"] == "true" and
         is_binary(variables["LOCAL_TEST_ACTORS_SECRET"]) and
         byte_size(variables["LOCAL_TEST_ACTORS_SECRET"]) >= 32 and
         config[:hostname] in @local_hosts and config[:database] == "groupher_server_dev" and
         config[:port] in [nil, 5432] and is_nil(config[:url]) do
      {:ok, :pass}
    else
      {:error, :local_test_environment_required}
    end
  end

  def check_database(["groupher_server_dev", address]) when address in @local_addresses do
    {:ok, :pass}
  end

  def check_database(_), do: {:error, :local_test_database_required}

  def admit do
    with {:ok, :pass} <-
           check_environment(
             Application.get_env(:groupher_server, :env),
             System.get_env(),
             Repo.config()
           ),
         %{rows: [identity]} <-
           Repo.query!("SELECT current_database(), host(inet_server_addr())", []),
         {:ok, :pass} <- check_database(identity) do
      {:ok, :pass}
    end
  end
end
