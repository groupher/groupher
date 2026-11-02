defmodule GroupherServer.CMS.Tickets.Commands.RemoveCaseMember do
  @moduledoc """
  Owns the remove_case_member Ticket command and its receipt transaction.

      Tickets facade -> RemoveCaseMember.execute -> Gate -> Lifecycle/Persist -> Activity/Outbox
  """
  use GroupherServer.CommandPipeline, adapter: GroupherServer.CMS.CommandPipelineAdapter
  alias GroupherServer.CMS
  alias CMS.Tickets.Commands.MutationConfirmation, as: Confirmation

  @doc "Executes the remove_case_member command through the canonical receipt boundary."
  def execute(community, case_id, ticket_id, expected_version, actor, command_id) do
    command_params = %{
      "type" => "remove_case_member",
      "case_id" => case_id,
      "ticket_id" => ticket_id,
      "expected_version" => expected_version
    }

    run(community, case_id, ticket_id, expected_version, actor, command_id, command_params)
  end

  @pipeline operation: :ticket_remove_case_member,
            confirmation: Confirmation,
            target: :community,
            params: [:command_params]
  receipt_pipeline run(
                     community,
                     case_id,
                     ticket_id,
                     expected_version,
                     actor,
                     command_id,
                     command_params
                   ) do
    gate(fn candidate ->
      CMS.Gate.check_community_workflow_in_transaction(actor, :ticket_manage_case, candidate)
    end)

    change(fn canonical ->
      CMS.Tickets.Persist.remove_case_member(canonical, case_id, ticket_id, expected_version, %{
        actor: actor,
        command_id: command_id
      })
    end)

    confirm(fn ticket_id ->
      {:ok,
       %Confirmation{
         data: %{
           "ticket_id" => ticket_id,
           "community_id" => community.id,
           "action" => "ticket_manage_case"
         }
       }}
    end)

    present(fn %Confirmation{data: %{"ticket_id" => ticket_id}} ->
      CMS.Tickets.Query.get_internal(community, ticket_id, actor)
    end)
  end
end
