defmodule GroupherServer.CMS.DocTree.Commands.UpdateWorkspaceNode do
  @moduledoc """
  Updates a workspace node under Gate and Command Receipt.

      Docs update command -> Gate / Receipt -> WorkspaceUpdate -> working tree and Queue
  """

  use GroupherServer.CommandPipeline, adapter: GroupherServer.CMS.CommandPipelineAdapter

  alias GroupherServer.{Accounts, CMS}
  alias Accounts.Model.User
  alias CMS.DocTree.Commands.UpdateWorkspaceNodeConfirmation, as: Confirmation
  alias CMS.DocTree.{Publish.Queue, WorkspaceUpdate}
  alias CMS.Model.Community

  @pipeline operation: :docs_update_workspace_node,
            confirmation: Confirmation,
            target: :community,
            params: [:revision, :node_id, :patch]
  receipt_pipeline run_receipt(community, revision, node_id, patch, actor, command_id) do
    gate(fn candidate -> CMS.Gate.check_in_transaction(actor, :manage_docs, candidate) end)

    change(fn canonical, operation_ref ->
      with {:ok, queue} <- Queue.lock_or_create(canonical) do
        WorkspaceUpdate.run(canonical, queue, revision, node_id, patch, actor, operation_ref)
      end
    end)

    confirm(fn result ->
      {:ok,
       %Confirmation{
         data: %{"community_id" => community.id, "tree_revision" => result.tree_revision}
       }}
    end)

    present(fn confirmation -> present_result(confirmation, community, actor) end)
  end

  @doc "Updates a workspace node under the expected tree revision using a command receipt."
  def execute(%Community{} = community, revision, node_id, patch, %User{} = actor, command_id)
      when is_integer(revision) and revision >= 0 and is_binary(node_id) and is_map(patch) and
             is_binary(command_id) do
    run_receipt(community, revision, node_id, patch, actor, command_id)
  end

  def execute(_, _, _, _, _, _), do: {:error, :invalid_tree_input}

  defp present_result(
         %Confirmation{data: %{"community_id" => id, "tree_revision" => revision}},
         %Community{id: id} = community,
         actor
       ) do
    with {:ok, _} <- CMS.Gate.access_check(actor, :manage_docs, community) do
      {:ok, %{tree_revision: revision}}
    end
  end

  defp present_result(_, _, _), do: {:error, CMS.ErrorCat.command_result_unavailable()}
end
