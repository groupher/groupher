defmodule GroupherServer.CMS.DocTree.Commands.MoveWorkspaceNode do
  @moduledoc """
  Moves a workspace node under Gate and Command Receipt.

      Docs move command -> Gate / Receipt -> WorkspaceMove -> working tree and Queue
  """

  use GroupherServer.CommandPipeline, adapter: GroupherServer.CMS.CommandPipelineAdapter

  alias GroupherServer.{Accounts, CMS}
  alias Accounts.Model.User
  alias CMS.DocTree.Commands.UpdateWorkspaceNodeConfirmation, as: Confirmation
  alias CMS.DocTree.{Publish.Queue, WorkspaceUpdate}
  alias CMS.Model.Community

  @pipeline operation: :docs_move_workspace_node,
            confirmation: Confirmation,
            target: :community,
            params: [:revision, :node_id, :parent, :position]
  receipt_pipeline run_receipt(community, revision, node_id, parent, position, actor, command_id) do
    gate(fn candidate -> CMS.Gate.check_in_transaction(actor, :manage_docs, candidate) end)

    change(fn canonical, operation_ref ->
      with {:ok, queue} <- Queue.lock_or_create(canonical) do
        WorkspaceUpdate.move(
          canonical,
          queue,
          revision,
          node_id,
          parent,
          position,
          actor,
          operation_ref
        )
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

  @doc false
  def execute(
        %Community{} = community,
        revision,
        node_id,
        parent,
        position,
        %User{} = actor,
        command_id
      )
      when is_integer(revision) and revision >= 0 and is_binary(node_id) and
             (is_binary(parent) or is_nil(parent)) and is_integer(position) and position >= 0 and
             is_binary(command_id) do
    run_receipt(community, revision, node_id, parent, position, actor, command_id)
  end

  def execute(_, _, _, _, _, _, _), do: {:error, :invalid_tree_input}

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
