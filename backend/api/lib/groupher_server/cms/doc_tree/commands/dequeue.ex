defmodule GroupherServer.CMS.DocTree.Commands.Dequeue do
  @moduledoc """
  Removes Queue copies under Gate, discard confirmation and Command Receipt.

      Docs dequeue command -> Gate / Receipt -> DequeueBatch -> Queue and working copies
  """

  use GroupherServer.CommandPipeline, adapter: GroupherServer.CMS.CommandPipelineAdapter
  alias GroupherServer.{Accounts, CMS}
  alias Accounts.Model.User
  alias CMS.DocTree.Commands.DequeueConfirmation, as: Confirmation
  alias CMS.DocTree.Publish.Queue
  alias CMS.DocTree.Publish.Queue.DequeueBatch
  alias CMS.Model.Community

  @pipeline operation: :docs_dequeue,
            confirmation: Confirmation,
            target: :community,
            params: [:revision, :ids, :confirmation]
  receipt_pipeline run_receipt(community, revision, ids, confirmation, actor, command_id) do
    gate(fn candidate ->
      with {:ok, canonical} <- CMS.Gate.check_in_transaction(actor, :docs_queue_write, candidate),
           {:ok, canonical} <-
             CMS.Gate.check_in_transaction(actor, :docs_queue_preview, canonical) do
        {:ok, canonical}
      end
    end)

    change(fn canonical, operation_ref ->
      with {:ok, queue} <- Queue.lock_or_create(canonical) do
        DequeueBatch.run(canonical, queue, revision, ids, confirmation, actor, operation_ref)
      end
    end)

    confirm(fn result ->
      {:ok,
       %Confirmation{
         data: %{"community_id" => community.id, "queue_revision" => result.queue.queue_revision}
       }}
    end)

    present(fn result -> present_result(result, community, actor) end)
  end

  @doc "Removes Queue members after validating the revision-bound discard confirmation."
  def execute(%Community{} = community, revision, ids, confirmation, %User{} = actor, command_id)
      when is_integer(revision) and revision >= 0 and is_list(ids) and is_binary(command_id) do
    run_receipt(community, revision, ids, confirmation, actor, command_id)
  end

  def execute(_, _, _, _, _, _), do: {:error, :invalid_queue_members}

  defp present_result(
         %Confirmation{data: %{"community_id" => id, "queue_revision" => revision}},
         %Community{id: id} = community,
         actor
       ) do
    with {:ok, _} <- CMS.Gate.access_check(actor, :docs_queue_write, community),
         {:ok, _} <- CMS.Gate.access_check(actor, :docs_queue_preview, community) do
      {:ok, %{queue_revision: revision}}
    end
  end

  defp present_result(_, _, _), do: {:error, CMS.ErrorCat.command_result_unavailable()}
end
