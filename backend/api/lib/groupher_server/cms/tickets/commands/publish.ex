defmodule GroupherServer.CMS.Tickets.Commands.Publish do
  @moduledoc """
  Owns the publish Ticket command and its receipt transaction.

      Tickets facade -> Publish.execute -> Gate -> Lifecycle/Persist -> Activity/Outbox
  """
  use GroupherServer.CommandPipeline, adapter: GroupherServer.CMS.CommandPipelineAdapter
  alias GroupherServer.CMS
  alias CMS.Tickets.Commands.MutationConfirmation, as: Confirmation

  @doc "Executes the publish command through the canonical receipt boundary."
  def execute(
        community,
        ticket_id,
        reason,
        expected_draft_version,
        expected_lifecycle_version,
        expected_workflow_version,
        actor,
        command_id,
        expected_preview
      ) do
    command_params = %{
      "type" => "publish",
      "ticket_id" => ticket_id,
      "reason" => reason,
      "expected_draft_version" => expected_draft_version,
      "expected_lifecycle_version" => expected_lifecycle_version,
      "expected_workflow_version" => expected_workflow_version,
      "expected_preview" => expected_preview
    }

    run(
      community,
      ticket_id,
      reason,
      expected_draft_version,
      expected_lifecycle_version,
      expected_workflow_version,
      actor,
      command_id,
      expected_preview,
      command_params
    )
  end

  @pipeline operation: :ticket_publish,
            confirmation: Confirmation,
            target: :community,
            params: [:command_params]
  receipt_pipeline run(
                     community,
                     ticket_id,
                     reason,
                     expected_draft_version,
                     expected_lifecycle_version,
                     expected_workflow_version,
                     actor,
                     command_id,
                     expected_preview,
                     command_params
                   ) do
    gate(fn candidate ->
      CMS.Gate.check_community_workflow_in_transaction(
        actor,
        :ticket_manage_visibility,
        candidate
      )
    end)

    change(fn canonical ->
      with {:ok, published_id} <-
             CMS.Tickets.Persist.publish(
               canonical,
               ticket_id,
               reason,
               expected_draft_version,
               expected_lifecycle_version,
               expected_workflow_version,
               expected_preview,
               %{actor: actor, command_id: command_id}
             ),
           {:ok, _graph} <- CMS.Tickets.Mentions.update(published_id, canonical, command_id) do
        {:ok, published_id}
      end
    end)

    confirm(fn ticket_id ->
      {:ok,
       %Confirmation{
         data: %{
           "ticket_id" => ticket_id,
           "community_id" => community.id,
           "action" => "ticket_manage_visibility"
         }
       }}
    end)

    present(fn %Confirmation{data: %{"ticket_id" => ticket_id}} ->
      CMS.Tickets.Query.get_internal(community, ticket_id, actor)
    end)
  end
end
