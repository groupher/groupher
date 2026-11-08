# Pure capability checks: starts HTTP/crypto dependencies, never starts Repo or CMS jobs.
# Receives short-lived tokens through a protected input file; never logs credentials.
{:ok, _} = Application.ensure_all_started(:req)
{:ok, _} = Application.ensure_all_started(:jose)

alias GroupherServer.CMS.ArtimentMentions.MaintenanceAuthorization
alias GroupherServerWeb.ServiceAuth.Verifier

unless :ets.whereis(:groupher_service_auth_jwks) != :undefined do
  :ets.new(:groupher_service_auth_jwks, [:named_table, :public, :set])
end

Application.put_env(:groupher_server, Verifier,
  issuer: "https://auth.groupher.com",
  jwks_url: "https://auth.groupher.com/.well-known/jwks.json",
  audiences: ["phoenix:cms-maintenance"]
)

inputs = System.fetch_env!("CMS_MENTIONS_AUTH_PROBE_FILE") |> File.read!() |> Jason.decode!()
initialize = Map.fetch!(inputs, "initialize")
rebuild = Map.fetch!(inputs, "rebuild")
{:ok, _} = MaintenanceAuthorization.verify(initialize, :initialize)
{:ok, _} = MaintenanceAuthorization.verify(rebuild, :rebuild)

{:error, :mentions_maintenance_unauthorized} =
  MaintenanceAuthorization.verify(initialize, :rebuild)

{:error, :mentions_maintenance_unauthorized} =
  MaintenanceAuthorization.verify(rebuild, :initialize)

[header, payload, signature] = String.split(initialize, ".")
<<first, rest::binary>> = signature
changed = if first == ?A, do: ?B, else: ?A
tampered = Enum.join([header, payload, <<changed, rest::binary>>], ".")

{:error, :mentions_maintenance_unauthorized} =
  MaintenanceAuthorization.verify(tampered, :initialize)

IO.puts(Jason.encode!(%{checks: 5, status: "passed", receiver: "isolated-current-code"}))
