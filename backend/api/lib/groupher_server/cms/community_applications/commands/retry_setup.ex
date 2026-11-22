defmodule GroupherServer.CMS.CommunityApplications.Commands.RetrySetup do
  @moduledoc """
  `receipt_pipeline` that starts the Community setup workflow again.

      GraphQL -> RetrySetup -> Application Gate -> Setup workflow -> Receipt result
  """

  use GroupherServer.CommandPipeline,
    adapter: GroupherServer.CMS.CommandPipelineAdapter

  alias GroupherServer.{Accounts, CMS}

  alias CMS.Gate
  alias CMS.CommunityApplications.{Commands.Confirmation, Commands.Support}
  alias CMS.Communities.Setup
  alias Accounts.Model.User
  alias Helper.T

  @spec execute(String.t(), User.t(), integer(), Ecto.UUID.t()) :: T.domain_res(term())
  def execute(ref, %User{} = actor, expected_version, command_id) do
    with {:ok, application} <- Support.application(ref) do
      execute_pipeline(application, expected_version, actor, command_id)
    end
  end

  @pipeline operation: :community_application_retry_setup,
            confirmation: Confirmation,
            target: :application,
            params: [:expected_version]

  receipt_pipeline execute_pipeline(application, expected_version, actor, command_id) do
    gate(fn candidate ->
      Gate.check_application_in_transaction(actor, :application_retry_setup, candidate)
    end)

    change(fn canonical, _operation_ref ->
      with {:ok, _result} <-
             Setup.retry(canonical.public_ref, actor, expected_version, command_id) do
        {:ok, canonical}
      end
    end)

    confirm(fn canonical ->
      {:ok, Support.confirmation(Confirmation, canonical.id, command_id)}
    end)

    present(fn confirmation -> Support.result(confirmation) end)
  end
end
