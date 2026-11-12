defmodule GroupherServer.CMS.DocTree.Commands.SaveQueue do
  @moduledoc """
  Saves a Docs Queue copy under Gate, site lock and Command Receipt.

      Docs save command -> Gate / Receipt -> Queue.Save -> queued working copy
  """
  use GroupherServer.CommandPipeline, adapter: GroupherServer.CMS.CommandPipelineAdapter
  alias GroupherServer.{Accounts, CMS}
  alias Accounts.Model.User
  alias CMS.DocTree.Commands.{QueueAccess, SaveQueueConfirmation}
  alias CMS.DocTree.Publish.Queue
  alias CMS.Model.Community

  @pipeline operation: :docs_save_queue,
            confirmation: SaveQueueConfirmation,
            target: :community,
            params: [:queue_revision, :article_id, :work_revision, :attrs]
  receipt_pipeline run_receipt(
                     community,
                     queue_revision,
                     article_id,
                     work_revision,
                     attrs,
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

    change(fn canonical ->
      with {:ok, queue} <- Queue.lock_or_create(canonical),
           {:ok, :pass} <- QueueAccess.authorize(canonical, article_id, actor) do
        Queue.save(canonical, queue, queue_revision, article_id, work_revision, attrs, actor)
      end
    end)

    confirm(fn result ->
      {:ok,
       %SaveQueueConfirmation{
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
        work_revision,
        attrs,
        %User{} = actor,
        command_id
      )
      when is_integer(queue_revision) and queue_revision >= 0 and is_binary(article_id) and
             is_integer(work_revision) and work_revision > 0 and is_map(attrs) and
             is_binary(command_id) do
    run_receipt(
      community,
      queue_revision,
      article_id,
      work_revision,
      Map.drop(attrs, [:command_id, "command_id", :cur_user, "cur_user"]),
      actor,
      command_id
    )
  end

  def execute(_, _, _, _, _, _, _), do: {:error, :invalid_queue_member}

  defp present_result(
         %SaveQueueConfirmation{
           data: %{
             "community_id" => id,
             "article_id" => article_id,
             "queue_revision" => queue_revision,
             "working_copy_revision" => work_revision
           }
         },
         %Community{id: id} = community,
         actor
       ) do
    with {:ok, _} <- CMS.Gate.access_check(actor, :docs_queue_write, community),
         {:ok, _} <- CMS.Gate.access_check(actor, :docs_queue_preview, community),
         {:ok, :pass} <- QueueAccess.authorize(community, article_id, actor) do
      {:ok, %{queue_revision: queue_revision, working_copy_revision: work_revision}}
    end
  end

  defp present_result(_, _, _), do: {:error, CMS.ErrorCat.command_result_unavailable()}
end
