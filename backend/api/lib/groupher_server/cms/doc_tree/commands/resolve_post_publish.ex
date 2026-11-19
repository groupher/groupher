defmodule GroupherServer.CMS.DocTree.Commands.ResolvePostPublish do
  @moduledoc """
  Resolves a published Doc conflict against a checked default revision and Public Snapshot.

      Docs conflict command -> Gate / Receipt -> site lock -> ResolveConflict -> default copy
  """

  use GroupherServer.CommandPipeline, adapter: GroupherServer.CMS.CommandPipelineAdapter
  alias GroupherServer.{Accounts, CMS}
  alias Accounts.Model.User
  alias CMS.DocTree.Commands.{QueueAccess, ResolvePostPublishConfirmation}
  alias CMS.DocTree.Publish.{ResolveConflict, SiteLock}
  alias CMS.Model.Community

  @pipeline operation: :docs_resolve_post_publish,
            confirmation: ResolvePostPublishConfirmation,
            target: :community,
            params: [
              :article_id,
              :working_copy_id,
              :default_revision,
              :public_snapshot_id,
              :choices
            ]
  receipt_pipeline run_receipt(
                     community,
                     article_id,
                     working_copy_id,
                     default_revision,
                     public_snapshot_id,
                     choices,
                     actor,
                     command_id
                   ) do
    gate(fn candidate -> CMS.Gate.check_in_transaction(actor, :manage_docs, candidate) end)

    change(fn canonical, _operation_ref ->
      with {:ok, :acquired} <- SiteLock.acquire(canonical),
           {:ok, :pass} <- QueueAccess.authorize(canonical, article_id, actor) do
        ResolveConflict.resolve(
          canonical,
          article_id,
          working_copy_id,
          default_revision,
          public_snapshot_id,
          choices,
          actor
        )
      end
    end)

    confirm(fn result ->
      {:ok,
       %ResolvePostPublishConfirmation{
         data: %{
           "community_id" => community.id,
           "article_id" => result.article_id,
           "working_copy_revision" => result.working_copy && result.working_copy.revision
         }
       }}
    end)

    present(fn confirmation -> present_result(confirmation, community, actor) end)
  end

  @doc false
  def execute(
        %Community{} = community,
        article_id,
        working_copy_id,
        default_revision,
        public_snapshot_id,
        choices,
        %User{} = actor,
        command_id
      )
      when is_binary(article_id) and is_binary(working_copy_id) and is_integer(default_revision) and
             default_revision > 0 and
             is_binary(public_snapshot_id) and is_map(choices) and is_binary(command_id) do
    run_receipt(
      community,
      article_id,
      working_copy_id,
      default_revision,
      public_snapshot_id,
      choices,
      actor,
      command_id
    )
  end

  def execute(_, _, _, _, _, _, _, _), do: {:error, :invalid_doc_conflict_resolution}

  defp present_result(
         %ResolvePostPublishConfirmation{
           data: %{
             "community_id" => id,
             "article_id" => article_id,
             "working_copy_revision" => revision
           }
         },
         %Community{id: id} = community,
         actor
       ) do
    with {:ok, _} <- CMS.Gate.access_check(actor, :manage_docs, community),
         {:ok, :pass} <- QueueAccess.authorize(community, article_id, actor) do
      {:ok, %{working_copy_revision: revision}}
    end
  end

  defp present_result(_, _, _), do: {:error, CMS.ErrorCat.command_result_unavailable()}
end
