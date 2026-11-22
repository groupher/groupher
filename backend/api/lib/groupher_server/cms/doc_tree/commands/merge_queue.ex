defmodule GroupherServer.CMS.DocTree.Commands.MergeQueue do
  @moduledoc """
  Absorbs a checked default Doc revision into its Queue copy under Gate and Receipt.

      Docs merge command -> Gate / Receipt -> Queue.Merge -> queued working copy
  """

  use GroupherServer.CommandPipeline, adapter: GroupherServer.CMS.CommandPipelineAdapter
  alias GroupherServer.{Accounts, CMS}
  alias Accounts.Model.User
  alias CMS.DocTree.Commands.{MergeQueueConfirmation, QueueAccess}
  alias CMS.DocTree.Publish.Queue
  alias CMS.Model.Community

  @pipeline operation: :docs_merge_queue,
            confirmation: MergeQueueConfirmation,
            target: :community,
            params: [:queue_revision, :article_id, :default_revision, :work_revision, :choices]
  receipt_pipeline run_receipt(
                     community,
                     queue_revision,
                     article_id,
                     default_revision,
                     work_revision,
                     choices,
                     actor,
                     command_id
                   ) do
    gate(fn candidate ->
      with {:ok, canonical} <- CMS.Gate.check_in_transaction(actor, :docs_queue_write, candidate),
           {:ok, canonical} <-
             CMS.Gate.check_in_transaction(actor, :docs_queue_preview, canonical) do
        {:ok, canonical}
      end
    end)

    change(fn canonical, operation_ref ->
      with {:ok, queue} <- Queue.lock_or_create(canonical),
           {:ok, :pass} <- QueueAccess.authorize(canonical, article_id, actor) do
        Queue.merge(
          canonical,
          queue,
          queue_revision,
          article_id,
          default_revision,
          work_revision,
          choices,
          actor,
          command_id,
          operation_ref
        )
      end
    end)

    confirm(fn result ->
      {:ok,
       %MergeQueueConfirmation{
         data: %{
           "community_id" => community.id,
           "article_id" => result.working_copy.article_id,
           "queue_revision" => result.queue.queue_revision,
           "working_copy_revision" => result.working_copy.revision
         }
       }}
    end)

    present(fn confirmation -> present_result(confirmation, community, actor) end)
  end

  @doc false
  def execute(
        %Community{} = community,
        queue_revision,
        article_id,
        default_revision,
        work_revision,
        choices,
        %User{} = actor,
        command_id
      )
      when is_integer(queue_revision) and queue_revision >= 0 and is_binary(article_id) and
             is_integer(default_revision) and default_revision > 0 and is_integer(work_revision) and
             work_revision > 0 and is_map(choices) and is_binary(command_id) do
    run_receipt(
      community,
      queue_revision,
      article_id,
      default_revision,
      work_revision,
      choices,
      actor,
      command_id
    )
  end

  def execute(_, _, _, _, _, _, _, _), do: {:error, :invalid_queue_merge}

  defp present_result(
         %MergeQueueConfirmation{
           data: %{
             "community_id" => id,
             "article_id" => article_id,
             "queue_revision" => revision,
             "working_copy_revision" => work_revision
           }
         },
         %Community{id: id} = community,
         actor
       ) do
    with {:ok, _} <- CMS.Gate.access_check(actor, :docs_queue_write, community),
         {:ok, _} <- CMS.Gate.access_check(actor, :docs_queue_preview, community),
         {:ok, :pass} <- QueueAccess.authorize_after_commit(community, article_id, actor) do
      {:ok, %{queue_revision: revision, working_copy_revision: work_revision}}
    end
  end

  defp present_result(_, _, _), do: {:error, CMS.ErrorCat.command_result_unavailable()}
end
