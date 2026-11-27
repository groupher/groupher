defmodule GroupherServer.Seed.Target do
  @moduledoc """
  Admits only Hub-managed development processes connected to the local dev database.

      local socket + private Hub key -> environment/config -> actual DB identity

  This module is compiled from dev/, never into a production release.
  """
  alias GroupherServer.Repo

  @local_hosts ["localhost", "127.0.0.1", "::1"]
  @local_addresses ["127.0.0.1", "127.0.0.1/32", "::1", "::1/128", nil]

  def check_environment(environment, variables, config, target \\ nil) do
    markers = ~w(NODE_ENV CLOUDFLARE_ENV ENVIRONMENT MIX_ENV)

    local_markers? =
      Enum.all?(markers, fn key ->
        value = variables |> Map.get(key, "") |> String.trim() |> String.downcase()
        value in ["", "dev", "development", "local"]
      end)

    expected_database = if target, do: target[:database], else: "groupher_server_dev"

    target_matches? =
      is_nil(target) or
        (target[:hostname] == config[:hostname] and target[:port] == config[:port])

    if environment == :dev and local_markers? and variables["CI"] != "true" and
         variables["DEV_HUB_MANAGED_ENVIRONMENT"] == "true" and
         is_binary(variables["LOCAL_TEST_ACTORS_SECRET"]) and
         byte_size(variables["LOCAL_TEST_ACTORS_SECRET"]) >= 32 and
         config[:hostname] in @local_hosts and config[:database] == expected_database and
         target_matches? and
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

  def check_database([database, address, port, comment], target) do
    with true <- is_list(target) and database == target[:database],
         true <- address in @local_addresses and port == 5432,
         [_, owner_id] <- Regex.run(~r/_([0-9a-f]{16})_dev\z/, database),
         {:ok, marker} when is_map(marker) <- Jason.decode(comment || ""),
         true <- marker["namespace"] == "groupher-devhub" and marker["formatVersion"] == 1,
         true <- marker["worktreeId"] == owner_id and marker["purpose"] == "dev",
         true <- Map.has_key?(marker, "previousComment"),
         true <- is_nil(marker["previousComment"]) or is_binary(marker["previousComment"]),
         false <- Map.has_key?(marker, "run") do
      {:ok, :pass}
    else
      _ -> {:error, :local_test_database_required}
    end
  end

  def admit do
    target = Application.get_env(:groupher_server, :managed_database_target)

    with {:ok, :pass} <-
           check_environment(
             Application.get_env(:groupher_server, :env),
             System.get_env(),
             Repo.config(),
             target
           ),
         %{rows: [identity]} <-
           Repo.query!(
             "SELECT current_database(), host(inet_server_addr()), inet_server_port(), shobj_description(oid, 'pg_database') FROM pg_database WHERE datname = current_database()",
             []
           ),
         {:ok, :pass} <- check_actual_database(identity, target) do
      {:ok, :pass}
    end
  end

  defp check_actual_database([database, address, 5432, _comment], nil),
    do: check_database([database, address])

  defp check_actual_database(identity, target), do: check_database(identity, target)
end
