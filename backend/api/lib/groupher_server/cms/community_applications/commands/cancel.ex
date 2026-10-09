defmodule GroupherServer.CMS.CommunityApplications.Commands.Cancel do
  @moduledoc """
  Receipt-backed applicant cancellation Command.

      GraphQL -> Cancel -> Application Gate -> Writer transition -> Receipt result
  """

  alias GroupherServer.CMS
  alias CMS.{Command, Gate}
  alias CMS.CommunityApplications.{Commands.Confirmation, Commands.Support, Writer}
  alias GroupherServer.Accounts.Model.User
  alias Helper.T

  @spec execute(String.t(), User.t(), integer(), Ecto.UUID.t()) :: T.domain_res(term())
  def execute(public_ref, %User{} = actor, expected_version, command_id) do
    with {:ok, application} <- Support.application(public_ref) do
      command = %Command{
        actor: actor,
        command_id: command_id,
        operation: :community_application_cancel,
        target: application,
        params: %{expected_version: expected_version}
      }

      with {:ok, confirmation} <-
             Command.execute(command, action: &action/1, confirmation: Confirmation) do
        Support.result(confirmation)
      end
    end
  end

  defp action(%{
         actor: actor,
         target: application,
         params: %{expected_version: version},
         command_id: id
       }) do
    with {:ok, _} <-
           Gate.with_application_check(actor, :application_cancel, application, fn canonical ->
             Writer.cancel(canonical.public_ref, actor, version)
           end) do
      {:ok, Support.confirmation(Confirmation, application.id, id)}
    end
  end
end
