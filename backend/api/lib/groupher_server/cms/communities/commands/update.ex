defmodule GroupherServer.CMS.Communities.Commands.Update do
  @moduledoc """
  Updates Community fields under the canonical Gate transaction.

      Communities facade
        -> Commands.Update.execute
        -> CMS.Gate community lock
        -> Communities.Persist
        -> presentation Outbox intent
  """

  alias GroupherServer.CMS
  alias CMS.Command
  alias CMS.Communities.Commands.UpdateConfirmation
  alias CMS.Communities.Persist
  alias CMS.Dashboard.Effects
  alias CMS.Model.Community
  alias Helper.T

  @doc """
  Updates one Community as an authenticated domain command.

  ## Examples

      execute(...)
      #=> {:ok, value}
  """
  @spec execute(Community.t(), map(), term(), Ecto.UUID.t() | {:workflow, String.t()}) ::
          T.domain_res(Community.t())
  def execute(%Community{} = community, args, actor, {:workflow, workflow_ref} = identity)
      when is_binary(workflow_ref) do
    update_direct(community, args, actor, identity)
  end

  def execute(%Community{} = community, args, actor, command_id) do
    command = %Command{
      actor: actor,
      command_id: command_id,
      operation: :community_update,
      target: community,
      params: args
    }

    with {:ok, confirmation} <-
           Command.execute(command,
             action: &update_action/1,
             confirmation: UpdateConfirmation
           ) do
      present(confirmation)
    end
  end

  defp update_action(%{
         actor: actor,
         target: community,
         params: args,
         command_id: command_id
       }) do
    with {:ok, canonical} <- update_direct(community, args, actor, command_id) do
      {:ok,
       %UpdateConfirmation{
         data: %{"community_id" => canonical.id, "command_id" => command_id}
       }}
    end
  end

  defp update_direct(%Community{} = community, args, actor, identity) do
    CMS.Gate.with_community_check(actor, :update, community, fn canonical ->
      with {:ok, canonical} <- Persist.update_fields(canonical, args),
           {:ok, _event} <-
             Effects.enqueue_presentation_changed(canonical, identity) do
        {:ok, canonical}
      end
    end)
  end

  defp present(%UpdateConfirmation{data: %{"community_id" => community_id}} = confirmation) do
    case GroupherServer.Repo.get(Community, community_id) do
      %Community{} = community ->
        {:ok, Map.put(community, :command_id, confirmation.data["command_id"])}

      nil ->
        {:error, CMS.ErrorCat.command_result_unavailable()}
    end
  end
end
