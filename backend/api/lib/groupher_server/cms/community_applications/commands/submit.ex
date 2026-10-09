defmodule GroupherServer.CMS.CommunityApplications.Commands.Submit do
  @moduledoc """
  Receipt-backed submission Command for a Community Application.

      GraphQL -> Submit -> Application Gate -> Writer transition -> Receipt result
  """

  alias GroupherServer.CMS
  alias CMS.{Command, Gate}
  alias CMS.CommunityApplications.{Commands.Support, Writer}
  alias CMS.CommunityApplications.Commands.Confirmation
  alias GroupherServer.Accounts.Model.User
  alias Helper.T

  @spec execute(map(), User.t(), Ecto.UUID.t()) :: T.domain_res(term())
  def execute(attrs, %User{} = actor, command_id) when is_map(attrs) do
    command = %Command{
      actor: actor,
      command_id: command_id,
      operation: :community_application_submit,
      target: actor,
      params: attrs
    }

    with {:ok, confirmation} <-
           Command.execute(command, action: &action/1, confirmation: Confirmation) do
      Support.result(confirmation)
    end
  end

  defp action(%{actor: actor, params: attrs, command_id: command_id}) do
    with {:ok, application} <-
           Gate.with_application_create_check(actor, fn ->
             Writer.submit(attrs, actor, command_id)
           end) do
      {:ok, Support.confirmation(Confirmation, application.id, command_id)}
    end
  end
end
