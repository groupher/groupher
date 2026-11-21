defmodule GroupherServer.CMS.DocTree.Commands.DuplicateWorkspaceNode do
  @moduledoc """
  Duplicates a Docs workspace node under Gate and Command Receipt.

      Docs duplicate command -> Gate / Receipt -> WorkspaceDuplicate -> working tree and default copy
  """

  use GroupherServer.CommandPipeline, adapter: GroupherServer.CMS.CommandPipelineAdapter

  alias GroupherServer.{Accounts, CMS}
  alias Accounts.Model.User
  alias CMS.DocTree.Commands.DuplicateWorkspaceNodeConfirmation, as: Confirmation
  alias CMS.DocTree.{Publish.Queue, WorkspaceDuplicate}
  alias CMS.Model.Community

  @pipeline operation: :docs_duplicate_workspace_node,
            confirmation: Confirmation,
            target: :community,
            params: [:revision, :node_id]
  receipt_pipeline run_receipt(community, revision, node_id, actor, command_id) do
    gate(fn candidate -> CMS.Gate.check_in_transaction(actor, :manage_docs, candidate) end)

    change(fn canonical, operation_ref ->
      with {:ok, queue} <- Queue.lock_or_create(canonical) do
        WorkspaceDuplicate.run(canonical, queue, revision, node_id, actor, operation_ref)
      end
    end)

    confirm(fn result ->
      {:ok,
       %Confirmation{
         data: %{
           "community_id" => community.id,
           "node_id" => result.node_id,
           "article_id" => result.article_id,
           "working_copy_id" => result.working_copy_id,
           "tree_revision" => result.tree_revision
         }
       }}
    end)

    present(fn confirmation -> present_result(confirmation, community, actor) end)
  end

  @doc false
  def execute(%Community{} = community, revision, node_id, %User{} = actor, command_id)
      when is_integer(revision) and revision >= 0 and is_binary(node_id) and is_binary(command_id) do
    run_receipt(community, revision, node_id, actor, command_id)
  end

  def execute(_, _, _, _, _), do: {:error, :invalid_tree_input}

  defp present_result(
         %Confirmation{data: %{"community_id" => id} = data},
         %Community{id: id} = community,
         actor
       ) do
    with {:ok, _} <- CMS.Gate.access_check(actor, :manage_docs, community) do
      {:ok,
       %{
         node_id: data["node_id"],
         article_id: data["article_id"],
         working_copy_id: data["working_copy_id"],
         tree_revision: data["tree_revision"]
       }}
    end
  end

  defp present_result(_, _, _), do: {:error, CMS.ErrorCat.command_result_unavailable()}
end
