defmodule GroupherServer.CMS.DocTree.Commands.RestoreTrashItem do
  @moduledoc """
  Restores one Docs Trash item through the optional command receipt boundary.

      CMS.DocTree.restore_trash_item
        -> RestoreTrashItem.execute
        -> CMS.Command when actor exists -> DocTree.Trash -> replay result
  """

  use GroupherServer.CommandPipeline,
    adapter: GroupherServer.CMS.CommandPipelineAdapter

  alias GroupherServer.CMS
  alias GroupherServer.{CMS, Accounts}

  alias Accounts.Model.User
  alias CMS.Command.Receipt.Key, as: CommandKey
  alias CMS.DocTree.{CommandReplay, Commands.Support, Trash}
  alias CMS.DocTree.Commands.TreeConfirmation, as: Confirmation

  @pipeline operation: :doc_tree_restore_trash_item,
            confirmation: Confirmation,
            target: :command_target,
            params: :command_params
  receipt_pipeline run_receipt(
                     community,
                     id,
                     args,
                     domain_args,
                     actor,
                     command_id,
                     command_target,
                     command_params
                   ) do
    gate(fn _target -> CMS.Gate.check_in_transaction(actor, :manage_docs, community) end)
    change(fn canonical_community -> Trash.restore(canonical_community, id, domain_args) end)

    confirm(fn result ->
      target_key = "#{community.id}:#{id}"
      {:ok, %Confirmation{data: CommandReplay.tree_confirmation(result, target_key)}}
    end)

    present(fn confirmation -> CommandReplay.replay_confirmation(confirmation) end)
  end

  @pipeline operation: :doc_tree_restore_trash_item_internal,
            access: :internal,
            target: :community,
            params: [:id, :domain_args]
  direct_pipeline run_internal(community, id, domain_args) do
    gate(fn candidate ->
      CMS.Gate.check_in_transaction(:operations, :manage_docs, candidate)
    end)

    change(fn canonical_community -> Trash.restore(canonical_community, id, domain_args) end)
  end

  def execute(community, id, args) do
    clean_args = Support.drop_command_id(args)
    domain_args = canonical_args(clean_args)
    actor = Support.option(args, :actor)

    with {:ok, _command_id} <- CommandKey.validate(Support.option(args, :command_id)),
         %User{} <- actor do
      execute_command(community, id, args, domain_args, actor)
    else
      nil -> {:error, :command_actor_required}
      {:error, _reason} = error -> error
      _ -> {:error, :command_actor_required}
    end
  end

  @doc false
  def execute_internal(community, id, args) do
    run_internal(community, id, canonical_args(Support.drop_command_id(args)))
  end

  defp execute_command(community, id, args, domain_args, actor) do
    run_receipt(
      community,
      id,
      args,
      domain_args,
      actor,
      Support.option(args, :command_id),
      {:doc_tree, community.id},
      %{id: id, args: domain_args}
    )
  end

  defp canonical_args(opts) when is_map(opts), do: opts
  defp canonical_args(opts) when is_list(opts), do: Map.new(opts)
  defp canonical_args(opts), do: opts
end
