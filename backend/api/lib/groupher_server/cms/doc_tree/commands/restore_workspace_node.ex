defmodule GroupherServer.CMS.DocTree.Commands.RestoreWorkspaceNode do
  @moduledoc """
  Restores one complete Docs Trash action under site Gate and Receipt.

      Docs restore command -> Gate / Receipt -> WorkspaceRestore -> working tree and Queue
  """
  use GroupherServer.CommandPipeline, adapter: GroupherServer.CMS.CommandPipelineAdapter
  alias GroupherServer.{Accounts, CMS, Repo}
  alias Accounts.Model.User
  alias CMS.DocTree.Commands.RestoreWorkspaceNodeConfirmation, as: Confirmation
  alias CMS.DocTree.{Publish.Queue, WorkspaceRestore}
  alias CMS.Model.{Community, DocsTreeNode}

  @pipeline operation: :docs_restore_workspace_node,
            confirmation: Confirmation,
            target: :community,
            params: [:tree_revision, :queue_revision, :action_id, :target_parent, :target_index]
  receipt_pipeline run_receipt(
                     community,
                     tree_revision,
                     queue_revision,
                     action_id,
                     target_parent,
                     target_index,
                     actor,
                     command_id
                   ) do
    gate(fn candidate -> CMS.Gate.check_in_transaction(actor, :manage_docs, candidate) end)

    change(fn canonical ->
      with {:ok, queue} <- Queue.lock_or_create(canonical) do
        WorkspaceRestore.run(
          canonical,
          queue,
          tree_revision,
          queue_revision,
          action_id,
          target_parent,
          target_index,
          actor
        )
      end
    end)

    confirm(fn result ->
      {:ok,
       %Confirmation{
         data: %{
           "community_id" => community.id,
           "node_id" => result.node_id,
           "tree_revision" => result.tree_revision,
           "queue_revision" => result.queue_revision
         }
       }}
    end)

    present(fn confirmation -> present_result(confirmation, community, actor) end)
  end

  @doc "Restores a Trash action once with expected workspace and Queue versions."
  def execute(
        %Community{} = community,
        tree_revision,
        queue_revision,
        action_id,
        target_parent,
        target_index,
        %User{} = actor,
        command_id
      )
      when is_integer(tree_revision) and tree_revision >= 0 and is_integer(queue_revision) and
             queue_revision >= 0 and is_binary(action_id) and is_binary(command_id) and
             (is_nil(target_parent) or is_binary(target_parent)) and
             (is_nil(target_index) or (is_integer(target_index) and target_index >= 0)) do
    run_receipt(
      community,
      tree_revision,
      queue_revision,
      action_id,
      target_parent,
      target_index,
      actor,
      command_id
    )
  end

  def execute(_, _, _, _, _, _, _, _), do: {:error, :invalid_tree_input}

  defp present_result(
         %Confirmation{data: %{"community_id" => id} = data},
         %Community{id: id} = community,
         actor
       ) do
    with {:ok, _} <- CMS.Gate.access_check(actor, :manage_docs, community),
         %DocsTreeNode{} <-
           Repo.get_by(DocsTreeNode, community_id: id, stage: :draft, node_id: data["node_id"]) do
      {:ok,
       %{
         node_id: data["node_id"],
         tree_revision: data["tree_revision"],
         queue_revision: data["queue_revision"]
       }}
    else
      _ -> {:error, CMS.ErrorCat.command_result_unavailable()}
    end
  end

  defp present_result(_, _, _), do: {:error, CMS.ErrorCat.command_result_unavailable()}
end
