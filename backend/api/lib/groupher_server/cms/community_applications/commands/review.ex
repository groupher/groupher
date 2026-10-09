defmodule GroupherServer.CMS.CommunityApplications.Commands.Review do
  @moduledoc """
  Receipt-backed reviewer transition Commands.

      GraphQL -> Review action -> Application Gate -> Writer transition -> Receipt result
  """

  alias GroupherServer.CMS
  alias CMS.{Command, Gate}
  alias CMS.CommunityApplications.{Commands.Confirmation, Commands.Support, Review}
  alias GroupherServer.Accounts.Model.User
  alias Helper.T

  @spec start(String.t(), User.t(), integer(), Ecto.UUID.t()) :: T.domain_res(term())
  def start(ref, actor, version, command_id),
    do:
      execute(
        :community_application_review,
        ref,
        actor,
        %{expected_version: version},
        command_id,
        fn canonical -> Review.start(canonical.public_ref, actor, version) end
      )

  @spec approve(String.t(), User.t(), integer(), map(), Ecto.UUID.t()) :: T.domain_res(term())
  def approve(ref, actor, version, metadata, command_id),
    do:
      execute(
        :community_application_approve,
        ref,
        actor,
        %{expected_version: version, metadata: metadata},
        command_id,
        fn canonical ->
          Review.approve(canonical.public_ref, actor, version, metadata, command_id)
        end
      )

  @spec reject(String.t(), User.t(), integer(), map(), Ecto.UUID.t()) :: T.domain_res(term())
  def reject(ref, actor, version, reason, command_id),
    do:
      execute(
        :community_application_reject,
        ref,
        actor,
        %{expected_version: version, reason: reason},
        command_id,
        fn canonical -> Review.reject(canonical.public_ref, actor, version, reason) end
      )

  @spec retry_creation(String.t(), User.t(), integer(), Ecto.UUID.t()) :: T.domain_res(term())
  def retry_creation(ref, actor, version, command_id),
    do:
      execute(
        :community_application_retry_creation,
        ref,
        actor,
        %{expected_version: version},
        command_id,
        fn canonical ->
          Review.retry_creation(canonical.public_ref, actor, version, command_id)
        end
      )

  defp execute(operation, ref, actor, params, command_id, callback) do
    with {:ok, application} <- Support.application(ref) do
      command = %Command{
        actor: actor,
        command_id: command_id,
        operation: operation,
        target: application,
        params: params
      }

      with {:ok, confirmation} <-
             Command.execute(command,
               action: fn %{target: canonical, command_id: id} ->
                 action = application_action(operation)

                 with {:ok, _} <- Gate.with_application_check(actor, action, canonical, callback) do
                   {:ok, Support.confirmation(Confirmation, canonical.id, id)}
                 end
               end,
               confirmation: Confirmation
             ) do
        Support.result(confirmation)
      end
    end
  end

  defp application_action(:community_application_review), do: :application_review
  defp application_action(:community_application_approve), do: :application_approve
  defp application_action(:community_application_reject), do: :application_reject
  defp application_action(:community_application_retry_creation), do: :application_retry_creation
end
