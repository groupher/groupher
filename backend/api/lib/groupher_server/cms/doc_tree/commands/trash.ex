defmodule GroupherServer.CMS.DocTree.Commands.Trash do
  @moduledoc """
  Runs the existing receipt-backed command that restores one Docs Trash item.

  Permanent deletion remains owned by `CMS.Trash` and is intentionally outside
  this module's command protocol.

  Business position:

      CMS.DocTree facade
        -> Commands.Trash
        -> CMS.Command / CommandReplay
        -> DocTree.Trash
  """

  alias GroupherServer.{Accounts, CMS}

  alias Accounts.Model.User
  alias CMS.Command
  alias CMS.DocTree.{CommandReplay, Trash}
  alias CMS.Model.Community
  alias Helper.T

  @doc "Restores one product Trash item through the existing command protocol."
  @spec restore(Community.t(), T.id(), map()) :: T.domain_res(map())
  def restore(%Community{} = community, id, args) do
    clean_args = drop_command_id(args)

    case option(args, :actor) do
      %User{} = actor ->
        target_key = "#{community.id}:#{id}"

        %Command{
          actor: actor,
          command_id: option(args, :command_id),
          operation: :doc_tree_restore_trash_item,
          target: {:doc_tree, community.id},
          params: %{id: id, args: clean_args}
        }
        |> Command.execute(
          action: fn %{params: %{args: clean_args}} ->
            with {:ok, result} <- Trash.restore(community, id, clean_args) do
              {:ok, result, CommandReplay.tree_metadata(result, target_key)}
            end
          end,
          result: &CommandReplay.replay_tree/1
        )

      _ ->
        Trash.restore(community, id, clean_args)
    end
  end

  defp option(opts, key) when is_map(opts), do: Map.get(opts, key)
  defp option(opts, key) when is_list(opts), do: Keyword.get(opts, key)
  defp option(_opts, _key), do: nil

  defp drop_command_id(opts) when is_map(opts), do: Map.delete(opts, :command_id)
  defp drop_command_id(opts) when is_list(opts), do: Keyword.delete(opts, :command_id)
  defp drop_command_id(opts), do: opts
end
