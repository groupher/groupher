defmodule GroupherServer.CMS.Communities.Commands.Update do
  @moduledoc """
  Updates Community fields under the canonical Gate transaction.

      Communities facade
        -> Commands.Update.execute
        -> CMS.Gate community lock
        -> Communities.Persist
        -> presentation Outbox intent
  """

  use GroupherServer.CommandPipeline,
    adapter: GroupherServer.CMS.CommandPipelineAdapter

  alias GroupherServer.CMS
  alias CMS.Communities.{Commands.UpdateConfirmation, Persist}
  alias CMS.FrontDesk
  alias CMS.Dashboard.Effects
  alias CMS.Model.Community

  @doc """
  Updates one Community as an authenticated domain command.

  ## Examples

      execute(...)
      #=> {:ok, value}
  """
  @pipeline operation: :community_update,
            confirmation: UpdateConfirmation,
            target: :community,
            params: [:args]

  receipt_pipeline execute_pipeline(community, args, actor, command_id) do
    gate(fn candidate -> CMS.Gate.check_in_transaction(actor, :update, candidate) end)

    change(fn canonical ->
      with {:ok, canonical} <- Persist.update_fields(canonical, args),
           {:ok, _event} <- Effects.enqueue_presentation_changed(canonical, command_id) do
        {:ok, canonical}
      end
    end)

    confirm(fn canonical ->
      {:ok,
       %UpdateConfirmation{
         data: %{"community_id" => canonical.id, "command_id" => command_id}
       }}
    end)

    present(fn confirmation -> present_result(confirmation) end)
  end

  @pipeline operation: :community_update_workflow,
            access: :internal,
            target: :community,
            params: [:args]
  direct_pipeline execute_workflow(community, args, actor, identity) do
    gate(fn candidate -> CMS.Gate.check_in_transaction(actor, :update, candidate) end)

    change(fn canonical ->
      with {:ok, canonical} <- Persist.update_fields(canonical, args),
           {:ok, _event} <-
             Effects.enqueue_presentation_changed(canonical, identity) do
        {:ok, canonical}
      end
    end)
  end

  defp present_result(%UpdateConfirmation{data: %{"community_id" => community_id}} = confirmation) do
    case FrontDesk.community(community_id, mode: :internal) do
      {:ok, %Community{} = community} ->
        {:ok, Map.put(community, :command_id, confirmation.data["command_id"])}

      {:error, _reason} ->
        {:error, CMS.ErrorCat.command_result_unavailable()}
    end
  end
end
