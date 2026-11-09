defmodule GroupherServer.CMS.Tickets.Commands.LinkSource do
  @moduledoc """
  Owns the link_source Ticket command and its receipt transaction.

      Tickets facade -> LinkSource.execute -> Gate -> Lifecycle/Persist -> Activity/Outbox
  """
  use GroupherServer.CommandPipeline, adapter: GroupherServer.CMS.CommandPipelineAdapter
  alias GroupherServer.CMS
  alias CMS.Tickets.Commands.MutationConfirmation, as: Confirmation

  @doc "Executes the link_source command through the canonical receipt boundary."
  def execute(community, ticket_id, type, post_id, expected_version, actor, command_id)
      when type in [:post, "post", "POST"] do
    type = :post

    command_params = %{
      "type" => "link_source",
      "ticket_id" => ticket_id,
      "source_type" => to_string(type),
      "post_id" => post_id,
      "expected_version" => expected_version
    }

    run(community, ticket_id, type, post_id, expected_version, actor, command_id, command_params)
  end

  def execute(_community, _ticket_id, _type, _source_id, _version, _actor, _command_id) do
    {:error, :unsupported_ticket_source_type}
  end

  @pipeline operation: :ticket_link_source,
            confirmation: Confirmation,
            target: :community,
            params: [:command_params]
  receipt_pipeline run(
                     community,
                     ticket_id,
                     type,
                     post_id,
                     expected_version,
                     actor,
                     command_id,
                     command_params
                   ) do
    gate(fn candidate ->
      CMS.Gate.check_community_workflow_in_transaction(actor, :ticket_link_source, candidate)
    end)

    change(fn canonical ->
      CMS.Tickets.Persist.link_source(canonical, ticket_id, type, post_id, expected_version, %{
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
           "action" => "ticket_link_source"
         }
       }}
    end)

    present(fn %Confirmation{data: %{"ticket_id" => ticket_id}} ->
      CMS.Tickets.Query.get_internal(community, ticket_id, actor)
    end)
  end
end
