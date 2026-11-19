defmodule GroupherServer.CMS.DocTree.Commands.ReleaseQueue do
  @moduledoc """
  Releases a site's complete Docs Queue under Gate and Command Receipt.

    The GraphQL entry requires the target schema; remaining publication effects
    must be switched before deploying the new contract.

      Docs release command -> Gate / Receipt -> QueueRelease -> Public and Release
  """

  use GroupherServer.CommandPipeline,
    adapter: GroupherServer.CMS.CommandPipelineAdapter

  alias GroupherServer.{Accounts, CMS, Repo}
  alias Accounts.Model.User
  alias CMS.DocTree.Commands.ReleaseQueueConfirmation, as: Confirmation
  alias CMS.DocTree.Publish.{Queue, QueueRelease}
  alias CMS.Model.{Community, DocsRelease}

  @pipeline operation: :doc_release_queue,
            confirmation: Confirmation,
            target: :community,
            params: [:revision]
  receipt_pipeline run_receipt(community, revision, actor, command_id) do
    gate(fn candidate -> CMS.Gate.check_in_transaction(actor, :docs_queue_publish, candidate) end)

    change(fn canonical, operation_ref ->
      with {:ok, queue} <- Queue.lock_or_create(canonical) do
        QueueRelease.run(canonical, queue, revision, actor, command_id, operation_ref)
      end
    end)

    confirm(fn result ->
      {:ok,
       %Confirmation{
         data: %{
           "community_id" => community.id,
           "release_id" => result.release.id,
           "queue_revision" => result.queue.queue_revision
         }
       }}
    end)

    present(fn confirmation -> present_result(confirmation, community, actor) end)
  end

  @doc false
  def execute(%Community{} = community, revision, %User{} = actor, command_id)
      when is_integer(revision) and revision >= 0 and is_binary(command_id) do
    run_receipt(community, revision, actor, command_id)
  end

  def execute(_, _, _, _), do: {:error, :invalid_docs_publish}

  defp present_result(
         %Confirmation{data: %{"community_id" => id, "release_id" => release_id} = data},
         %Community{id: id} = community,
         actor
       ) do
    with {:ok, _} <- CMS.Gate.access_check(actor, :docs_queue_publish, community),
         %DocsRelease{community_id: ^id, sealed: true} <- Repo.get(DocsRelease, release_id) do
      {:ok, %{release_id: release_id, queue_revision: data["queue_revision"]}}
    else
      _ -> {:error, CMS.ErrorCat.command_result_unavailable()}
    end
  end

  defp present_result(_, _, _), do: {:error, CMS.ErrorCat.command_result_unavailable()}
end
