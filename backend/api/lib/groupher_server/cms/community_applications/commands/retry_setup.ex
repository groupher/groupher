defmodule GroupherServer.CMS.CommunityApplications.Commands.RetrySetup do
  @moduledoc """
  Receipt-backed Command that starts the Community setup workflow again.

      GraphQL -> RetrySetup -> Application Gate -> Setup workflow -> Receipt result
  """

  alias GroupherServer.CMS
  alias CMS.{Command, Gate}
  alias CMS.CommunityApplications.{Commands.Confirmation, Commands.Support}
  alias CMS.Communities.Setup
  alias GroupherServer.Accounts.Model.User
  alias Helper.T

  @spec execute(String.t(), User.t(), integer(), Ecto.UUID.t()) :: T.domain_res(term())
  def execute(ref, %User{} = actor, expected_version, command_id) do
    with {:ok, application} <- Support.application(ref) do
      command = %Command{
        actor: actor,
        command_id: command_id,
        operation: :community_application_retry_setup,
        target: application,
        params: %{expected_version: expected_version}
      }

      with {:ok, confirmation} <-
             Command.execute(command,
               action: fn %{target: canonical, command_id: id} ->
                 with {:ok, _} <-
                        Gate.with_application_check(
                          actor,
                          :application_retry_setup,
                          canonical,
                          fn app ->
                            Setup.retry(app.public_ref, actor, expected_version, command_id)
                          end
                        ) do
                   {:ok, Support.confirmation(Confirmation, canonical.id, id)}
                 end
               end,
               confirmation: Confirmation
             ) do
        Support.result(confirmation)
      end
    end
  end
end
