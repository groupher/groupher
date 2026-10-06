defmodule GroupherServer.CMS.DocTree.Commands.RestoreTrashItem do
  @moduledoc """
  Restores one Docs Trash item through the optional command receipt boundary.

      CMS.DocTree.restore_trash_item
        -> RestoreTrashItem.execute
        -> CMS.Command when actor exists -> DocTree.Trash -> replay result
  """

  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS.Command
  alias GroupherServer.CMS.DocTree.{CommandReplay, Commands.Support, Trash}
  alias GroupherServer.CMS.DocTree.Commands.TreeConfirmation, as: Confirmation

  def execute(community, id, args) do
    clean_args = Support.drop_command_id(args)
    domain_args = canonical_args(clean_args)

    case {Support.option(args, :actor), Support.option(args, :command_id)} do
      {%User{} = actor, command_id} when is_binary(command_id) ->
        execute_command(community, id, args, domain_args, actor)

      _ ->
        Trash.restore(community, id, clean_args)
    end
  end

  defp execute_command(community, id, args, domain_args, actor) do
    target_key = "#{community.id}:#{id}"

    %Command{
      actor: actor,
      command_id: Support.option(args, :command_id),
      operation: :doc_tree_restore_trash_item,
      target: {:doc_tree, community.id},
      params: %{id: id, args: domain_args}
    }
    |> Command.execute(
      action: fn %{params: %{args: command_args}} ->
        with {:ok, result} <- Trash.restore(community, id, command_args) do
          {:ok, %Confirmation{data: CommandReplay.tree_confirmation(result, target_key)}}
        end
      end,
      confirmation: Confirmation
    )
    |> then(fn
      {:ok, value} -> CommandReplay.replay_confirmation(value)
      error -> error
    end)
  end

  defp canonical_args(opts) when is_map(opts), do: opts
  defp canonical_args(opts) when is_list(opts), do: Map.new(opts)
  defp canonical_args(opts), do: opts
end
