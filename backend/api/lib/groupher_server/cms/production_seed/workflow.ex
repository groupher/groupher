defmodule GroupherServer.CMS.ProductionSeed.Workflow do
  @moduledoc """
  Release-compatible production acceptance owner.

      Operator -> explicit opt-in + actual database identity -> locked run ledger
               -> fixed bootstrap / domain seed / cleanup

  No operation targets an inferred database. Only one run can own the fixed
  identities at a time. Closing a run is required before opening another.
  """
  import Ecto.Query
  alias GroupherServer.{CMS, Repo}
  alias CMS.ProductionSeed.{Run, Bootstrap}

  @doc "Checks explicit opt-in and the actual connection identity, never DB_NAME alone."
  def admit(database) do
    cond do
      System.get_env("PRODUCTION_SEED_ENABLED") != "true" ->
        {:error, :seed_disabled}

      not is_binary(database) or database == "" ->
        {:error, :seed_database_required}

      Repo.query!("SELECT current_database()", []).rows != [[database]] ->
        {:error, :seed_wrong_database}

      true ->
        {:ok, database}
    end
  end

  @doc "Creates or recovers a fixed bootstrap for a two-hour window."
  def bootstrap(run_id, database) do
    with {:ok, _} <- admit(database),
         true <-
           is_binary(run_id) and Regex.match?(~r/\A[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}\z/, run_id) do
      Repo.transaction(fn ->
        advisory_lock!()

        run =
          case Repo.get_by(Run, run_id: run_id) do
            nil ->
              if Repo.exists?(from(r in Run, where: r.status == "active")) do
                Repo.rollback(:seed_other_run_active)
              end

              Repo.insert!(%Run{
                run_id: run_id,
                database_name: database,
                expires_at: DateTime.add(DateTime.utc_now(:second), 7200)
              })

            _ ->
              lock!(run_id)
          end

        manifest = Bootstrap.apply(run.manifest)
        run |> Ecto.Changeset.change(manifest: manifest) |> Repo.update!() |> describe()
      end)
    else
      false -> {:error, :seed_invalid_run_id}
      {:error, reason} -> {:error, reason}
    end
  end

  @doc "Returns internal operational IDs and public locators, without credentials/session refs."
  def report(run_id, database) do
    with {:ok, _} <- admit(database) do
      case Repo.get_by(Run, run_id: run_id) do
        nil -> {:error, :seed_run_not_found}
        %{database_name: ^database} = run -> {:ok, describe(run)}
        _ -> {:error, :seed_wrong_ledger_database}
      end
    end
  end

  @doc "Locks a run in an existing transaction, rejecting expired/closed writes."
  def lock!(run_id, active \\ true) do
    run =
      Repo.one(from(r in Run, where: r.run_id == ^run_id, lock: "FOR UPDATE")) ||
        Repo.rollback(:seed_run_not_found)

    if Repo.query!("SELECT current_database()", []).rows != [[run.database_name]] do
      Repo.rollback(:seed_wrong_ledger_database)
    end

    if active and
         (run.status != "active" or DateTime.compare(run.expires_at, DateTime.utc_now()) != :gt) do
      Repo.rollback(:seed_run_closed_or_expired)
    end

    run
  end

  @doc "Serializes changes involving the shared fixed accounts and community namespace."
  def advisory_lock! do
    Repo.query!("SELECT pg_advisory_xact_lock(778031104)", [])
    {:ok, :locked}
  end

  defp describe(run) do
    Map.merge(run.manifest, %{
      "runId" => run.run_id,
      "status" => run.status,
      "database" => run.database_name,
      "expiresAt" => DateTime.to_iso8601(run.expires_at)
    })
  end
end
