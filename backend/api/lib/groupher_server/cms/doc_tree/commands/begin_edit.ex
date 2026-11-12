defmodule GroupherServer.CMS.DocTree.Commands.BeginEdit do
  @moduledoc """
  Explicitly starts editing a public Doc, creating its default copy only if absent.

      BeginEdit -> Gate / Receipt -> site / Article locks -> current Public -> D identity
  """
  use GroupherServer.CommandPipeline, adapter: GroupherServer.CMS.CommandPipelineAdapter
  alias GroupherServer.{Accounts, CMS}
  alias Accounts.Model.User
  alias CMS.DocTree.Commands.{BeginEditConfirmation, QueueAccess}
  alias CMS.DocTree.{DefaultCopy, Publish.SiteLock}
  alias CMS.Model.Community

  @pipeline operation: :docs_begin_edit,
            confirmation: BeginEditConfirmation,
            target: :community,
            params: [:article_id, :public_snapshot_id]
  receipt_pipeline run_receipt(community, article_id, public_snapshot_id, actor, command_id) do
    gate(fn candidate -> CMS.Gate.check_in_transaction(actor, :manage_docs, candidate) end)

    change(fn canonical ->
      with {:ok, :acquired} <- SiteLock.acquire(canonical),
           {:ok, :pass} <- QueueAccess.authorize(canonical, article_id, actor),
           {:ok, state} <- DefaultCopy.load(canonical, article_id),
           true <- state.lifecycle.state == :published do
        DefaultCopy.ensure(canonical, article_id, public_snapshot_id, actor)
      else
        false -> {:error, :invalid_doc_lifecycle}
        {:error, _} = error -> error
      end
    end)

    confirm(fn work ->
      {:ok,
       %BeginEditConfirmation{
         data: %{
           "community_id" => community.id,
           "article_id" => article_id,
           "working_copy_id" => work.id,
           "revision" => work.revision
         }
       }}
    end)

    present(fn confirmation ->
      with {:ok, _} <- CMS.Gate.access_check(actor, :manage_docs, community),
           {:ok, :pass} <- QueueAccess.authorize(community, article_id, actor) do
        {:ok,
         %{
           working_copy_id: confirmation.data["working_copy_id"],
           revision: confirmation.data["revision"]
         }}
      end
    end)
  end

  @doc "Creates or returns D for an explicitly selected current public Snapshot."
  def execute(%Community{} = community, article_id, snapshot_id, %User{} = actor, command_id)
      when is_binary(article_id) and is_binary(snapshot_id) and is_binary(command_id) do
    run_receipt(community, article_id, snapshot_id, actor, command_id)
  end

  def execute(_, _, _, _, _), do: {:error, :invalid_doc_identity}
end
