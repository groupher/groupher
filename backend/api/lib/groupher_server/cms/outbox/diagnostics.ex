defmodule GroupherServer.CMS.Outbox.Diagnostics do
  @moduledoc """
  Reads a bounded batch of current failures after current root admission.

      root operator -> persisted failure -> domain publication proof
        -> pending alert / superseded diagnosis, without changing delivery state
  """

  import Ecto.Query

  alias GroupherServer.{Accounts, CMS, Repo}
  alias Accounts.Model.User
  alias CMS.Outbox.Event

  @doc "Lists a bounded set of current failures, separating proven replacements from pending alerts."
  def diagnose_failures(%User{} = actor, limit) when is_integer(limit) and limit in 1..100 do
    with {:ok, :authorized} <- authorize_root(actor) do
      events =
        Repo.all(
          from(event in Event,
            where: event.status == :failed,
            order_by: [desc: event.updated_at, asc: event.id],
            limit: ^limit
          )
        )

      result =
        Enum.reduce(events, %{scanned: length(events), pending: [], superseded: []}, fn event,
                                                                                        result ->
          diagnosis =
            case CMS.Outbox.validate_event_contract(event) do
              {:ok, :pass} -> CMS.Articles.Effects.recovery_status(event)
              error -> error
            end

          case diagnosis do
            {:ok, %{outcome: :superseded} = details} ->
              Map.update!(result, :superseded, &[details | &1])

            {:ok, details} ->
              Map.update!(
                result,
                :pending,
                &[
                  Map.merge(details, %{
                    failure_generation: event.failure_generation,
                    last_error_code: event.last_error_code
                  })
                  | &1
                ]
              )

            {:error, reason} ->
              Map.update!(
                result,
                :pending,
                &[
                  %{
                    outcome: :pending,
                    event_id: event.id,
                    failure_generation: event.failure_generation,
                    contract_error: reason
                  }
                  | &1
                ]
              )
          end
        end)

      {:ok,
       %{
         result
         | pending: Enum.reverse(result.pending),
           superseded: Enum.reverse(result.superseded)
       }}
    end
  end

  def diagnose_failures(_actor, _limit), do: {:error, :invalid_outbox_diagnostics_request}

  defp authorize_root(actor) do
    case CMS.Passport.system_root?(actor.id) do
      {:ok, true} -> {:ok, :authorized}
      _ -> {:error, :permission_denied}
    end
  end
end
