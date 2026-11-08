defmodule GroupherServer.CMS.ProductionSeed.CLI do
  @moduledoc """
  Fixed release RPC dispatch for production acceptance, with JSON output.

      production_seed.sh request.json -> base64 RPC -> fixed command allowlist
        -> domain admission -> JSON report or non-zero RPC exception

  No arbitrary function, SQL, user ID or evaluator is accepted. Credential
  issuance was removed after the production acceptance window.
  """
  alias GroupherServer.CMS.ProductionSeed

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

      "close" ->
        ProductionSeed.Logins.close(run_id, database)

      "delete-tmp" ->
        ProductionSeed.Cleanup.delete_tmp(run_id, database)

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
end
