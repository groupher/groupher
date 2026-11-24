defmodule Mix.Tasks.Passport.LegacyReport do
  @moduledoc """
  Reports legacy Passport conversion candidates without changing authorization.

      mix passport.legacy_report
        -> repeatable-read read-only transaction -> per-user plans and exceptions

  Run only against the explicitly selected target environment and protect the
  output as authorization data. An exception-free report is not a cutover.
  """
  use Mix.Task
  import Ecto.Query

  alias GroupherServer.{CMS, Repo}
  alias CMS.Model.Passport
  alias CMS.Passport.LegacyPlan

  @shortdoc "Reports legacy Passport conversion candidates without writes"
  @doc "Runs a repeatable-read, read-only legacy Passport conversion report for every user with a Passport row."
  def run([]) do
    Mix.Task.run("app.config")
    {:ok, _} = Application.ensure_all_started(:ecto_sql)
    {:ok, _} = Application.ensure_all_started(:postgrex)
    {:ok, _repo} = Repo.start_link()

    result =
      Repo.transaction(fn ->
        Repo.query!("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY")

        Repo.all(
          from(passport in Passport,
            where: not is_nil(passport.user_id),
            order_by: passport.user_id,
            select: passport.user_id
          )
        )
        |> Enum.map(fn user_id ->
          case LegacyPlan.report(user_id) do
            {:ok, plan} -> %{user_id: user_id, plan: plan}
            {:error, reason} -> Repo.rollback({user_id, reason})
          end
        end)
      end)

    case result do
      {:ok, plans} -> Mix.shell().info(Jason.encode!(%{reports: plans}))
      {:error, reason} -> Mix.raise("Passport legacy report failed: #{inspect(reason)}")
    end
  end

  def run(_), do: Mix.raise("Usage: mix passport.legacy_report")
end
