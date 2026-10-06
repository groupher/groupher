defmodule GroupherServer.CMS.DocTree.Commands.Support do
  @moduledoc """
  Shares command construction and replay mechanics between concrete DocTree use cases.

      Commands.<BusinessAction>.execute
        -> Support command wrapper
        -> CMS.Command / CommandReplay -> action callback

  This module is infrastructure for the concrete commands and is not a facade-callable
  business action.
  """

  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS.Command
  alias GroupherServer.CMS.DocTree.CommandReplay
  alias GroupherServer.CMS.DocTree.Commands.TreeConfirmation, as: Confirmation

  def run_tree_command(community, target_id, args, user, operation, execute) do
    clean_args = drop_command_id(args)

    case {user, option(args, :command_id)} do
      {%User{} = actor, command_id} when not is_nil(command_id) ->
        target_key = "#{community.id}:#{target_id}"

        %Command{
          actor: actor,
          command_id: command_id,
          operation: operation,
          target: {:doc_tree, community.id},
          params: %{target_id: target_id, args: canonical_args(clean_args)}
        }
        |> Command.execute(
          action: fn %{params: %{args: command_args}} ->
            with {:ok, result} <- execute.(command_args) do
              {:ok, %Confirmation{data: CommandReplay.tree_confirmation(result, target_key)}}
            end
          end,
          confirmation: Confirmation
        )
        |> then(fn
          {:ok, value} -> CommandReplay.replay_confirmation(value)
          error -> error
        end)

      _ ->
        execute.(clean_args)
    end
  end

  def run_doc_command(community, id, user, operation, opts, confirmation, execute, present) do
    case option(opts, :command_id) do
      nil ->
        case execute.() do
          {:ok, result, _receipt_metadata} -> {:ok, result}
          {:ok, value} -> present.(value)
          other -> other
        end

      command_id ->
        %Command{
          actor: user,
          command_id: command_id,
          operation: operation,
          target: {:doc, community.id},
          params: %{id: id, opts: canonical_args(opts)}
        }
        |> Command.execute(action: fn _context -> execute.() end, confirmation: confirmation)
        |> then(fn
          {:ok, value} -> present.(value)
          error -> error
        end)
    end
  end

  def actor(args, fallback \\ nil), do: fallback || option(args, :actor)

  def option(opts, key) when is_map(opts), do: Map.get(opts, key)
  def option(opts, key) when is_list(opts), do: Keyword.get(opts, key)
  def option(_opts, _key), do: nil

  def drop_command_id(opts) when is_map(opts), do: Map.delete(opts, :command_id)
  def drop_command_id(opts) when is_list(opts), do: Keyword.delete(opts, :command_id)
  def drop_command_id(opts), do: opts

  def canonical_args(opts) when is_map(opts), do: Map.delete(opts, :command_id)

  def canonical_args(opts) when is_list(opts) do
    opts |> Keyword.delete(:command_id) |> Map.new()
  end
end
