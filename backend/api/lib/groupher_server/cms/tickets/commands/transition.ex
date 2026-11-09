defmodule GroupherServer.CMS.Tickets.Commands.Transition do
  @moduledoc """
  Owns the transition Ticket command and its receipt transaction.

      Tickets facade -> Transition.execute -> Gate -> Lifecycle/Persist -> Activity/Outbox
  """
  use GroupherServer.CommandPipeline, adapter: GroupherServer.CMS.CommandPipelineAdapter
  alias GroupherServer.CMS
  alias CMS.Tickets.Commands.MutationConfirmation, as: Confirmation

  @doc "Executes the transition command through the canonical receipt boundary."
  def execute(community, ticket_id, status, expected_version, actor, command_id) do
    command_params = %{
      "type" => "transition",
      "ticket_id" => ticket_id,
      "status" => if(is_nil(status), do: nil, else: to_string(status)),
      "expected_version" => expected_version
    }

    run(community, ticket_id, status, expected_version, actor, command_id, command_params)
  end

  @pipeline operation: :ticket_transition,
            confirmation: Confirmation,
            target: :community,
            params: [:command_params]
  receipt_pipeline run(
                     community,
                     ticket_id,
                     status,
                     expected_version,
                     actor,
                     command_id,
                     command_params
                   ) do
    gate(fn candidate ->
      CMS.Gate.check_community_workflow_in_transaction(actor, :ticket_transition, candidate)
    end)

    change(fn canonical ->
      CMS.Tickets.Persist.transition(canonical, ticket_id, status, expected_version, %{
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
