defmodule GroupherServer.CMS.Tickets.Commands.Move do
  @moduledoc """
  Owns the move Ticket command and its receipt transaction.

      Tickets facade -> Move.execute -> Gate -> Lifecycle/Persist -> Activity/Outbox
  """
  use GroupherServer.CommandPipeline, adapter: GroupherServer.CMS.CommandPipelineAdapter
  alias GroupherServer.CMS
  alias CMS.Tickets.Commands.MutationConfirmation, as: Confirmation

  @doc "Executes the move command through the canonical receipt boundary."
  def execute(community, ticket_id, status, rank, expected_version, actor, command_id) do
    command_params = %{
      "type" => "move",
      "ticket_id" => ticket_id,
      "status" => if(is_nil(status), do: nil, else: to_string(status)),
      "rank" => rank,
      "expected_version" => expected_version
    }

    run(community, ticket_id, status, rank, expected_version, actor, command_id, command_params)
  end

  @pipeline operation: :ticket_move,
            confirmation: Confirmation,
            target: :community,
            params: [:command_params]
  receipt_pipeline run(
                     community,
                     ticket_id,
                     status,
                     rank,
                     expected_version,
                     actor,
                     command_id,
                     command_params
                   ) do
    gate(fn candidate ->
      CMS.Gate.check_community_workflow_in_transaction(actor, :ticket_transition, candidate)
    end)

    change(fn canonical ->
      CMS.Tickets.Persist.move(canonical, ticket_id, status, rank, expected_version, %{
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
           "action" => "ticket_transition"
         }
       }}
    end)

    present(fn %Confirmation{data: %{"ticket_id" => ticket_id}} ->
      CMS.Tickets.Query.get_internal(community, ticket_id, actor)
    end)
  end
end
