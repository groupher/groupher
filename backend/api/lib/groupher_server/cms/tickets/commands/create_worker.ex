defmodule GroupherServer.CMS.Tickets.Commands.CreateWorker do
  @moduledoc """
  Owns the create_worker Ticket command and its receipt transaction.

      Tickets facade -> CreateWorker.execute -> Gate -> Lifecycle/Persist -> Activity/Outbox
  """
  use GroupherServer.CommandPipeline, adapter: GroupherServer.CMS.CommandPipelineAdapter
  alias GroupherServer.CMS
  alias CMS.Tickets.Commands.MutationConfirmation, as: Confirmation

  @doc "Executes the create_worker command through the canonical receipt boundary."
  def execute(community, parent_id, attrs, expected_version, actor, command_id) do
    command_params = %{
      "type" => "create_worker",
      "parent_id" => parent_id,
      "attrs" => Map.new(attrs, fn {key, value} -> {to_string(key), value} end),
      "expected_version" => expected_version
    }

    run(community, parent_id, attrs, expected_version, actor, command_id, command_params)
  end

  @pipeline operation: :ticket_create_worker,
            confirmation: Confirmation,
            target: :community,
            params: [:command_params]
  receipt_pipeline run(
                     community,
                     parent_id,
                     attrs,
                     expected_version,
                     actor,
                     command_id,
                     command_params
                   ) do
    gate(fn candidate ->
      CMS.Gate.check_community_workflow_in_transaction(actor, :ticket_create, candidate)
    end)

    change(fn canonical ->
      CMS.Tickets.Persist.create_worker(canonical, parent_id, attrs, expected_version, %{
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
           "action" => "ticket_create"
         }
       }}
    end)

    present(fn %Confirmation{data: %{"ticket_id" => ticket_id}} ->
      CMS.Tickets.Query.get_internal(community, ticket_id, actor)
    end)
  end
end
