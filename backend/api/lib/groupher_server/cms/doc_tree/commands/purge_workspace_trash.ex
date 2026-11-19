defmodule GroupherServer.CMS.DocTree.Commands.PurgeWorkspaceTrash do
  @moduledoc """
  Permanently clears an unreferenced Docs Trash action under Gate and Receipt.

      Docs purge command / scheduler -> Gate -> WorkspaceTrashPurge -> working copy and Trash
  """
  use GroupherServer.CommandPipeline, adapter: GroupherServer.CMS.CommandPipelineAdapter
  import Ecto.Query
  alias GroupherServer.{Accounts, CMS, Repo}
  alias Accounts.Model.User
  alias CMS.DocTree.Commands.PurgeWorkspaceTrashConfirmation, as: Confirmation
  alias CMS.DocTree.{Publish.Queue, WorkspaceTrashPurge}
  alias CMS.Model.{Community, TrashAction}

  @pipeline operation: :docs_purge_workspace_trash,
            confirmation: Confirmation,
            target: :community,
            params: [:queue_revision, :action_id]
  receipt_pipeline run_receipt(community, queue_revision, action_id, actor, command_id) do
    gate(fn candidate ->
      with {:ok, community} <- CMS.Gate.check_in_transaction(actor, :manage_docs, candidate),
           {:ok, community} <- CMS.Gate.check_in_transaction(actor, :docs_trash_purge, community) do
        {:ok, community}
      end
    end)

    change(fn canonical, _operation_ref ->
      with {:ok, queue} <- Queue.lock_or_create(canonical) do
        WorkspaceTrashPurge.run(canonical, queue, queue_revision, action_id, actor, command_id)
      end
    end)

    confirm(fn result ->
      {:ok,
       %Confirmation{
         data: %{"community_id" => community.id, "trash_action_id" => result.trash_action_id}
       }}
    end)

    present(fn confirmation -> present_result(confirmation, community, actor) end)
  end

  @pipeline operation: :docs_purge_workspace_trash_due,
            access: :internal,
            target: :action,
            params: :now
  direct_pipeline run_due(action, now) do
    gate(fn candidate ->
      case Repo.get(Community, candidate.community_id) do
        %Community{} = community ->
          CMS.Gate.check_in_transaction(:operations, :manage_docs, community)

        nil ->
          {:error, :invalid_docs_site}
      end
    end)

    change(fn community, _operation_ref ->
      with {:ok, queue} <- Queue.lock_or_create(community) do
        case Repo.one(
               from(a in TrashAction,
                 where:
                   a.id == ^action.id and a.community_id == ^community.id and
                     a.root_type == "doc_tree_node",
                 lock: "FOR UPDATE"
               )
             ) do
          nil ->
            {:ok, :already_removed}

          current ->
            if DateTime.compare(current.scheduled_permanent_deletion_at, now) in [:lt, :eq] do
              WorkspaceTrashPurge.run(
                community,
                queue,
                queue.queue_revision,
                current.hash_id,
                :operations,
                current.hash_id
              )
            else
              {:error, :docs_trash_not_due}
            end
        end
      end
    end)
  end

  @doc false
  def execute_due(%TrashAction{root_type: "doc_tree_node"} = action, %DateTime{} = now) do
    run_due(action, now)
  end

  def execute_due(_, _), do: {:error, :invalid_trash_action}

  @doc "Permanently removes one Trash action once after checking its Queue version."
  def execute(%Community{} = community, queue_revision, action_id, %User{} = actor, command_id)
      when is_integer(queue_revision) and queue_revision >= 0 and is_binary(action_id) and
             is_binary(command_id) do
    run_receipt(community, queue_revision, action_id, actor, command_id)
  end

  def execute(_, _, _, _, _), do: {:error, :invalid_tree_input}

  defp present_result(
         %Confirmation{data: %{"community_id" => id}},
         %Community{id: id} = community,
         actor
       ) do
    with {:ok, _} <- CMS.Gate.access_check(actor, :manage_docs, community),
         {:ok, _} <- CMS.Gate.access_check(actor, :docs_trash_purge, community) do
      {:ok, %{done: true}}
    end
  end

  defp present_result(_, _, _), do: {:error, CMS.ErrorCat.command_result_unavailable()}
end
