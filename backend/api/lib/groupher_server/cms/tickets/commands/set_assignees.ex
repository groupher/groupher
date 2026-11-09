defmodule GroupherServer.CMS.Tickets.Commands.SetAssignees do
  @moduledoc """
  Owns the set_assignees Ticket command and its receipt transaction.

      Tickets facade -> SetAssignees.execute -> Gate -> Lifecycle/Persist -> Activity/Outbox
  """
  use GroupherServer.CommandPipeline, adapter: GroupherServer.CMS.CommandPipelineAdapter
  alias GroupherServer.CMS
  alias CMS.Tickets.Commands.MutationConfirmation, as: Confirmation

  @doc "Executes the set_assignees command through the canonical receipt boundary."
  def execute(community, ticket_id, user_ids, expected_version, actor, command_id) do
    command_params = %{
      "type" => "set_assignees",
      "ticket_id" => ticket_id,
      "user_ids" => user_ids,
      "expected_version" => expected_version
    }

    run(community, ticket_id, user_ids, expected_version, actor, command_id, command_params)
  end

  @pipeline operation: :ticket_set_assignees,
            confirmation: Confirmation,
            target: :community,
            params: [:command_params]
  receipt_pipeline run(
                     community,
                     ticket_id,
                     user_ids,
                     expected_version,
                     actor,
                     command_id,
                     command_params
                   ) do
    gate(fn candidate ->
      CMS.Gate.check_community_workflow_in_transaction(actor, :ticket_assign, candidate)
    end)

    change(fn canonical ->
      CMS.Tickets.Persist.set_assignees(canonical, ticket_id, user_ids, expected_version, %{
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
           "action" => "ticket_assign"
         }
       }}
    end)

    present(fn %Confirmation{data: %{"ticket_id" => ticket_id}} ->
      CMS.Tickets.Query.get_internal(community, ticket_id, actor)
    end)
  end
end
