defmodule GroupherServer.CMS.Wallpaper.Commands.RestoreSnapshot do
  @moduledoc """
  Restores one retained Wallpaper Snapshot through Gate and Command receipt.

      GraphQL -> Wallpaper.Commands.RestoreSnapshot -> Gate -> Wallpaper.Workflow
  """

  use GroupherServer.CommandPipeline,
    adapter: GroupherServer.CMS.CommandPipelineAdapter

  alias GroupherServer.{Accounts, CMS}
  alias Accounts.Model.User
  alias CMS.Model.Community
  alias CMS.Wallpaper.{Workflow, Commands.Confirmation}
  alias Helper.T

  @pipeline operation: :wallpaper_restore_snapshot,
            confirmation: Confirmation,
            target: :community,
            params: :input
  receipt_pipeline run_receipt(community, input, actor, command_id) do
    gate(fn candidate -> CMS.Gate.check_in_transaction(actor, :update, candidate) end)

    change(fn canonical, _operation_ref ->
      restore_input = input |> Map.delete("command_id") |> Map.put(:command_id, command_id)
      Workflow.run_restore_snapshot(canonical, restore_input, actor)
    end)

    confirm(fn %{version: version} ->
      {:ok, Confirmation.build(Confirmation, community.id, version, command_id)}
    end)

    present(fn confirmation -> Confirmation.result(confirmation) end)
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
