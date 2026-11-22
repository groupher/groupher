defmodule GroupherServer.CMS.CommunityApplications.Commands.Cancel do
  @moduledoc """
  Applicant cancellation implemented as a `receipt_pipeline`.

      GraphQL -> Cancel Command -> Application Gate -> Persist / Lifecycle -> Receipt result
  """

  use GroupherServer.CommandPipeline,
    adapter: GroupherServer.CMS.CommandPipelineAdapter

  alias GroupherServer.{Accounts, CMS}
  alias Accounts.Model.User
  alias CMS.Gate
  alias Ecto.Multi
  alias CMS.Communities.{ErrorCat, SlugClaims}
  alias CMS.CommunityApplications.{Commands.Confirmation, Commands.Support, Lifecycle}
  alias Helper.{T, Transaction}

  @spec execute(String.t(), User.t(), integer(), Ecto.UUID.t()) :: T.domain_res(term())
  def execute(public_ref, %User{} = actor, expected_version, command_id) do
    with {:ok, application} <- Support.application(public_ref) do
      execute_pipeline(application, expected_version, actor, command_id)
    end
  end

  @pipeline operation: :community_application_cancel,
            confirmation: Confirmation,
            target: :application,
            params: [:expected_version]

  receipt_pipeline execute_pipeline(application, expected_version, actor, command_id) do
    gate(fn candidate ->
      Gate.check_application_in_transaction(actor, :application_cancel, candidate)
    end)

    change(fn canonical, _operation_ref ->
      cancel_application(canonical, actor, expected_version)
    end)

    confirm(fn canonical ->
      {:ok, Support.confirmation(Confirmation, canonical.id, command_id)}
    end)

    present(fn confirmation -> Support.result(confirmation) end)
  end

  defp cancel_application(application, actor, expected_version) do
    now = DateTime.utc_now(:second)

    with {:ok, _} <- expected_version(application, expected_version),
         {:ok, %{application: updated}} <-
           Multi.new()
           |> Lifecycle.add(
             :application,
             :event,
             application,
             :cancelled,
             %{cancelled_at: now, expires_at: nil},
             %{type: :applicant, id: actor.id, occurred_at: now}
           )
           |> SlugClaims.release_application(:claim, application, now)
           |> Transaction.join() do
      {:ok, updated}
    end
  end

  defp expected_version(%{version: version}, version), do: {:ok, :pass}
  defp expected_version(_, _), do: {:error, ErrorCat.application_state_conflict()}
end
