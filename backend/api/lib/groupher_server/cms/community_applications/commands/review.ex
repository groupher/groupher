defmodule GroupherServer.CMS.CommunityApplications.Commands.Review do
  @moduledoc """
  Receipt pipelines for reviewer transitions on Community Applications.

      CommunityApplications facade
        -> Review command
        -> Gate + review transition + Confirmation
        -> canonical application result

  Each public action loads the application by public reference before entering
  its operation-specific pipeline; retry recovery uses the same Confirmation
  presenter as the first execution.
  """

  use GroupherServer.CommandPipeline,
    adapter: GroupherServer.CMS.CommandPipelineAdapter

  alias GroupherServer.{Accounts, CMS}
  alias Accounts.Model.User
  alias CMS.CommunityApplications.{Commands.Confirmation, Commands.Support, Review}
  alias Helper.T

  @pipeline operation: :community_application_review,
            confirmation: Confirmation,
            target: :application,
            params: :params
  receipt_pipeline start_pipeline(application, actor, params, command_id) do
    gate(fn candidate ->
      CMS.Gate.check_application_in_transaction(actor, :application_review, candidate)
    end)

    change(fn canonical, _operation_ref ->
      Review.start(canonical.public_ref, actor, Map.fetch!(params, :expected_version))
    end)

    confirm(fn canonical ->
      {:ok, Support.confirmation(Confirmation, canonical.id, command_id)}
    end)

    present(fn confirmation -> Support.result(confirmation) end)
  end

  @pipeline operation: :community_application_approve,
            confirmation: Confirmation,
            target: :application,
            params: :params
  receipt_pipeline approve_pipeline(application, actor, params, command_id) do
    gate(fn candidate ->
      CMS.Gate.check_application_in_transaction(actor, :application_approve, candidate)
    end)

    change(fn canonical, _operation_ref ->
      Review.approve(
        canonical.public_ref,
        actor,
        Map.fetch!(params, :expected_version),
        Map.fetch!(params, :metadata),
        command_id
      )
    end)

    confirm(fn canonical ->
      {:ok, Support.confirmation(Confirmation, canonical.id, command_id)}
    end)

    present(fn confirmation -> Support.result(confirmation) end)
  end

  @pipeline operation: :community_application_reject,
            confirmation: Confirmation,
            target: :application,
            params: :params
  receipt_pipeline reject_pipeline(application, actor, params, command_id) do
    gate(fn candidate ->
      CMS.Gate.check_application_in_transaction(actor, :application_reject, candidate)
    end)

    change(fn canonical, _operation_ref ->
      Review.reject(
        canonical.public_ref,
        actor,
        Map.fetch!(params, :expected_version),
        Map.fetch!(params, :reason)
      )
    end)

    confirm(fn canonical ->
      {:ok, Support.confirmation(Confirmation, canonical.id, command_id)}
    end)

    present(fn confirmation -> Support.result(confirmation) end)
  end

  @pipeline operation: :community_application_retry_creation,
            confirmation: Confirmation,
            target: :application,
            params: :params
  receipt_pipeline retry_creation_pipeline(application, actor, params, command_id) do
    gate(fn candidate ->
      CMS.Gate.check_application_in_transaction(actor, :application_retry_creation, candidate)
    end)

    change(fn canonical, _operation_ref ->
      Review.retry_creation(
        canonical.public_ref,
        actor,
        Map.fetch!(params, :expected_version),
        command_id
      )
    end)

    confirm(fn canonical ->
      {:ok, Support.confirmation(Confirmation, canonical.id, command_id)}
    end)

    present(fn confirmation -> Support.result(confirmation) end)
  end

  @spec start(String.t(), User.t(), integer(), Ecto.UUID.t()) :: T.domain_res(term())
  def start(ref, actor, version, command_id) do
    with {:ok, application} <- Support.application(ref) do
      start_pipeline(application, actor, %{expected_version: version}, command_id)
    end
  end

  @spec approve(String.t(), User.t(), integer(), map(), Ecto.UUID.t()) :: T.domain_res(term())
  def approve(ref, actor, version, metadata, command_id) do
    with {:ok, application} <- Support.application(ref) do
      approve_pipeline(
        application,
        actor,
        %{expected_version: version, metadata: metadata},
        command_id
      )
    end
  end

  @spec reject(String.t(), User.t(), integer(), map(), Ecto.UUID.t()) :: T.domain_res(term())
  def reject(ref, actor, version, reason, command_id) do
    with {:ok, application} <- Support.application(ref) do
      reject_pipeline(
        application,
        actor,
        %{expected_version: version, reason: reason},
        command_id
      )
    end
  end

  @spec retry_creation(String.t(), User.t(), integer(), Ecto.UUID.t()) :: T.domain_res(term())
  def retry_creation(ref, actor, version, command_id) do
    with {:ok, application} <- Support.application(ref) do
      retry_creation_pipeline(application, actor, %{expected_version: version}, command_id)
    end
  end
end
