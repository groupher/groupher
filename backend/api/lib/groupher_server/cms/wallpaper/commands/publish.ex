defmodule GroupherServer.CMS.Wallpaper.Commands.Publish do
  @moduledoc """
  Publishes one Wallpaper Snapshot through Gate and the shared Command receipt.

      GraphQL -> Wallpaper.Commands.Publish -> Gate -> Wallpaper.Workflow
  """

  use GroupherServer.CommandPipeline,
    adapter: GroupherServer.CMS.CommandPipelineAdapter

  alias GroupherServer.{Accounts, CMS}
  alias Accounts.Model.User
  alias CMS.Model.Community
  alias CMS.Wallpaper.{Workflow, Commands.Confirmation}
  alias Helper.T

  @pipeline operation: :wallpaper_publish,
            confirmation: Confirmation,
            target: :community,
            params: :input
  receipt_pipeline run_receipt(community, input, actor, command_id) do
    prepare(fn ->
      publish_input = input |> Map.delete("command_id") |> Map.put(:command_id, command_id)
      Workflow.prepare_publish(community, publish_input, actor)
    end)

    gate(fn prepared ->
      with {:ok, canonical} <- CMS.Gate.check_in_transaction(actor, :update, community) do
        {:ok, {canonical, prepared}}
      end
    end)

    change(fn {canonical, prepared}, _operation_ref ->
      Workflow.commit_publish(canonical, prepared)
    end)

    confirm(fn %{version: version} ->
      {:ok, Confirmation.build(Confirmation, community.id, version, command_id)}
    end)

    present(fn confirmation -> Confirmation.result(confirmation) end)

    cleanup(fn failure ->
      Workflow.cleanup_publish(failure.input.prepared)
    end)
  end

  @spec execute(Community.t(), map(), User.t()) :: T.domain_res(map())
  def execute(%Community{} = community, input, %User{} = actor) when is_map(input) do
    command_id = get(input, :command_id)

    run_receipt(community, input, actor, command_id)
  end

  defp get(map, key) when is_map(map) and is_atom(key) do
    Map.get(map, key) || Map.get(map, Atom.to_string(key))
  end

  defp get(_map, _key), do: nil
end
