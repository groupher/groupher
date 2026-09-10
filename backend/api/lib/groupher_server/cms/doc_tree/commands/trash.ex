defmodule GroupherServer.CMS.DocTree.Commands.Trash do
  @moduledoc """
  Runs the existing receipt-backed command that restores one Docs Trash item.

  Permanent deletion remains owned by `CMS.Trash` and is intentionally outside
  this module's command protocol.

  Business position:

      CMS.DocTree facade
        -> Commands.Trash
        -> CommandReceipt / CommandReplay
        -> DocTree.Trash
  """

  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS
  alias CMS.CommandReceipt
  alias CMS.DocTree.{CommandReplay, Trash}
  alias CMS.Model.Community
  alias Helper.T

  @doc "Restores one product Trash item through the existing command protocol."
  @spec restore(Community.t(), T.id(), map()) :: T.domain_res(map())
  def restore(%Community{} = community, id, args) do
    clean_args = drop_command_key(args)

    case option(args, :actor) do
      %User{} = actor ->
        with {:ok, command_key} <- CommandReceipt.resolve_command_key(args) do
          target_key = "#{community.id}:#{id}"

          CommandReceipt.run_user_command(
            actor,
            command_key,
            "doc.tree.restore_trash_item",
            "doc_tree",
            target_key,
            clean_args,
            fn ->
              with {:ok, result} <- Trash.restore(community, id, clean_args) do
                {:ok, result, CommandReplay.tree_metadata(result, target_key)}
              end
            end,
            &CommandReplay.replay_tree/1
          )
        end

      _ ->
        Trash.restore(community, id, clean_args)
    end
  end

  defp option(opts, key) when is_map(opts), do: Map.get(opts, key)
  defp option(opts, key) when is_list(opts), do: Keyword.get(opts, key)
  defp option(_opts, _key), do: nil

  defp drop_command_key(opts) when is_map(opts), do: Map.delete(opts, :command_key)
  defp drop_command_key(opts) when is_list(opts), do: Keyword.delete(opts, :command_key)
  defp drop_command_key(opts), do: opts
end
