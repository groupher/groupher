defmodule GroupherServer.CMS.DocTree.Commands.DeleteWorkspaceNode do
  @moduledoc """
  Deletes one workspace subtree under site Gate, confirmation and Receipt.

      Docs delete command -> Gate / Receipt -> WorkspaceDelete -> Queue and Trash
  """

  use GroupherServer.CommandPipeline, adapter: GroupherServer.CMS.CommandPipelineAdapter
  alias GroupherServer.{Accounts, CMS, Repo}
  alias Accounts.Model.User
  alias CMS.DocTree.Commands.DeleteWorkspaceNodeConfirmation, as: Confirmation
  alias CMS.DocTree.{Publish.Queue, WorkspaceDelete}
  alias CMS.Model.{Community, TrashAction}

  @pipeline operation: :docs_delete_workspace_node,
            confirmation: Confirmation,
            target: :community,
            params: [:tree_revision, :queue_revision, :node_id, :confirmation]
  receipt_pipeline run_receipt(
                     community,
                     tree_revision,
                     queue_revision,
                     node_id,
                     confirmation,
                     actor,
                     command_id
                   ) do
    gate(fn candidate -> CMS.Gate.check_in_transaction(actor, :manage_docs, candidate) end)

    change(fn canonical, operation_ref ->
      with {:ok, queue} <- Queue.lock_or_create(canonical) do
        WorkspaceDelete.run(
          canonical,
          queue,
          tree_revision,
          queue_revision,
          node_id,
          confirmation,
          actor,
          operation_ref
        )
      end
    end)

    confirm(fn result ->
      {:ok,
       %Confirmation{
         data: %{
           "community_id" => community.id,
           "trash_action_id" => result.trash_action_id,
           "tree_revision" => result.tree_revision,
           "queue_revision" => result.queue_revision
         }
       }}
    end)

    present(fn confirmation -> present_result(confirmation, community, actor) end)
  end

  @doc "Deletes the expected workspace subtree once."
  def execute(
        %Community{} = community,
        tree_revision,
        queue_revision,
        node_id,
        confirmation,
        %User{} = actor,
        command_id
      )
      when is_integer(tree_revision) and tree_revision >= 0 and is_integer(queue_revision) and
             queue_revision >= 0 and is_binary(node_id) and is_binary(command_id) do
    run_receipt(
      community,
      tree_revision,
      queue_revision,
      node_id,
      confirmation,
      actor,
      command_id
    )
  end

  def execute(_, _, _, _, _, _, _), do: {:error, :invalid_tree_input}

  defp present_result(
         %Confirmation{data: %{"community_id" => id} = data},
         %Community{id: id} = community,
         actor
       ) do
    with {:ok, _} <- CMS.Gate.access_check(actor, :manage_docs, community),
         %TrashAction{community_id: ^id} <-
           Repo.get_by(TrashAction, hash_id: data["trash_action_id"]) do
      {:ok,
       %{
         trash_action_id: data["trash_action_id"],
         tree_revision: data["tree_revision"],
         queue_revision: data["queue_revision"]
       }}
    else
      _ -> {:error, CMS.ErrorCat.command_result_unavailable()}
    end
  end

  defp present_result(_, _, _), do: {:error, CMS.ErrorCat.command_result_unavailable()}
end
