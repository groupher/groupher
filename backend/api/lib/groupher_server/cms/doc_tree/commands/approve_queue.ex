defmodule GroupherServer.CMS.DocTree.Commands.ApproveQueue do
  @moduledoc """
  Approves the complete Docs Queue under site and per-Doc admission.

      Docs approval command -> Gate / Receipt -> QueueRead -> Approval -> sealed snapshots

  QueueRead checks preview access to every affected Doc under the site lock;
  Approval validates contributors, source versions and the canonical plan.
  """
  use GroupherServer.CommandPipeline, adapter: GroupherServer.CMS.CommandPipelineAdapter

  alias GroupherServer.{Accounts, CMS, Repo}
  alias Accounts.Model.User
  alias CMS.DocTree.Commands.ApproveQueueConfirmation
  alias CMS.DocTree.Publish.{Approval, Queue, QueueRead}
  alias CMS.Model.{Community, DocsPublishApproval}

  @pipeline operation: :docs_approve_queue,
            confirmation: ApproveQueueConfirmation,
            target: :community,
            params: [:revision]
  receipt_pipeline run_receipt(community, revision, actor, command_id) do
    gate(fn candidate ->
      with {:ok, canonical} <-
             CMS.Gate.check_in_transaction(actor, :docs_queue_approve, candidate),
           {:ok, canonical} <-
             CMS.Gate.check_in_transaction(actor, :docs_queue_preview, canonical) do
        {:ok, canonical}
      end
    end)

    change(fn canonical, operation_ref ->
      with {:ok, queue} <- Queue.lock_or_create(canonical),
           {:ok, _} <- QueueRead.read(canonical, actor) do
        Approval.approve(canonical, queue, revision, actor, command_id, operation_ref)
      end
    end)

    confirm(fn result ->
      {:ok,
       %ApproveQueueConfirmation{
         data: %{
           "community_id" => community.id,
           "approval_id" => result.approval.id,
           "queue_revision" => result.queue.queue_revision
         }
       }}
    end)

    present(fn confirmation -> present_result(confirmation, community, actor) end)
  end

  @doc "Records an approval for the current Queue revision through an idempotent command receipt."
  def execute(%Community{} = community, revision, %User{} = actor, command_id)
      when is_integer(revision) and revision >= 0 and is_binary(command_id) do
    run_receipt(community, revision, actor, command_id)
  end

  def execute(_, _, _, _), do: {:error, :invalid_docs_approval}

  defp present_result(
         %ApproveQueueConfirmation{
           data: %{
             "community_id" => id,
             "approval_id" => approval_id,
             "queue_revision" => revision
           }
         },
         %Community{id: id} = community,
         actor
       ) do
    with {:ok, _} <- CMS.Gate.access_check(actor, :docs_queue_approve, community),
         {:ok, _} <- CMS.Gate.access_check(actor, :docs_queue_preview, community),
         %DocsPublishApproval{community_id: ^id, sealed: true} <-
           Repo.get(DocsPublishApproval, approval_id) do
      {:ok, %{approval_id: approval_id, queue_revision: revision}}
    else
      _ -> {:error, CMS.ErrorCat.command_result_unavailable()}
    end
  end

  defp present_result(_, _, _), do: {:error, CMS.ErrorCat.command_result_unavailable()}
end
