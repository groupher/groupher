defmodule GroupherServer.CMS.ProductionSeed.CLI do
  @moduledoc """
  Fixed release RPC dispatch for production acceptance, with JSON output.

      production_seed.sh request.json -> base64 RPC -> fixed command allowlist
        -> domain admission -> JSON report or non-zero RPC exception

  No arbitrary function, SQL, user ID or evaluator is accepted. Issue writes its
  secret to an exclusive mode-0600 file; RPC output contains only the filename.
  """
  alias GroupherServer.CMS.ProductionSeed
  alias GroupherServer.Repo

  @doc "Decodes a non-secret request and fails the release command on business error."
  def run_base64(encoded) do
    with {:ok, json} <- Base.decode64(encoded),
         {:ok, input} <- Jason.decode(json),
         {:ok, result} <- execute(input) do
      IO.puts(Jason.encode!(%{ok: true, result: result}, pretty: true))
      {:ok, result}
    else
      _ ->
        raise "production_seed operation failed; inspect the non-secret report and local validation"
    end
  end

  @doc "Dispatches the fixed operational command set; never starts or resets a database."
  def execute(%{"command" => command, "runId" => run_id, "database" => database} = input) do
    case command do
      "bootstrap" ->
        ProductionSeed.bootstrap(run_id, database)

      "seed" ->
        ProductionSeed.Content.apply(run_id, database, input["artifactPath"])

      "references" ->
        ProductionSeed.References.apply(run_id, database, input["artifactPath"])

      "report" ->
        ProductionSeed.report(run_id, database)

      "issue" ->
        issue(run_id, database, input["alias"], input["outputFile"])

      "close" ->
        ProductionSeed.Logins.close(run_id, database)

      "delete-tmp" ->
        ProductionSeed.Cleanup.delete_tmp(run_id, database)

      "map-failure" ->
        ProductionSeed.MapFailure.inject(run_id, database)

      "cleanup-report" ->
        ProductionSeed.Cleanup.report(run_id, database, input["mode"])

      "cleanup-apply" ->
        ProductionSeed.Cleanup.apply(run_id, database, input["mode"], input["reportDigest"])

      "cleanup-verify" ->
        ProductionSeed.Cleanup.verify(run_id, database, input["mode"])

      _ ->
        {:error, :seed_unknown_command}
    end
  end

  def execute(_), do: {:error, :seed_invalid_request}

  defp issue(run_id, database, name, output) when is_binary(output) do
    if Regex.match?(~r/\A\/tmp\/production-seed-[a-zA-Z0-9_-]+\.json\z/, output) do
      Repo.transaction(fn ->
        case ProductionSeed.Logins.issue(run_id, name, database) do
          {:ok, grant} ->
            case File.open(output, [:write, :exclusive]) do
              {:ok, file} ->
                try do
                  File.chmod!(output, 0o600)
                  IO.binwrite(file, Jason.encode!(grant))
                after
                  File.close(file)
                end

                %{credential_file: output, expires_at: grant.expires_at}

              {:error, _} ->
                Repo.rollback(:seed_credential_file_exists_or_unwritable)
            end

          {:error, reason} ->
            Repo.rollback(reason)
        end
      end)
    else
      {:error, :seed_invalid_credential_filename}
    end
  end

  defp issue(_, _, _, _), do: {:error, :seed_invalid_credential_filename}
end
