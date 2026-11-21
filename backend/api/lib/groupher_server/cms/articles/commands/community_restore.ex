defmodule GroupherServer.CMS.Articles.Commands.CommunityRestore do
  @moduledoc """
  Restores one non-Doc Binding using its exact Trash identity and version.

      Community + Article + Trash identity -> Gate -> restore -> Activity / Outbox -> Receipt
  """
  use GroupherServer.CommandPipeline, adapter: GroupherServer.CMS.CommandPipelineAdapter
  alias GroupherServer.{Accounts, CMS}
  alias Accounts.Model.User
  alias CMS.Articles.BindingTrashPersist
  alias CMS.Articles.Commands.{CommunityTrashConfirmation, CommunityTrashSupport}
  alias CMS.Model.Community

  def execute(
        %Community{} = community,
        article_id,
        trash_id,
        revision,
        %User{} = actor,
        command_id
      ) do
    with {:ok, article} <- CommunityTrashSupport.load_article(article_id) do
      run(article, community, community.id, trash_id, revision, actor, command_id)
    end
  end

  def execute(_, _, _, _, _, _), do: {:error, :invalid_article_binding}

  @pipeline operation: :community_article_restore,
            confirmation: CommunityTrashConfirmation,
            target: :article,
            params: [:community_id, :trash_id, :revision]
  receipt_pipeline run(article, community, community_id, trash_id, revision, actor, command_id) do
    gate(fn candidate ->
      CMS.Gate.check_in_transaction(actor, :community_restore, candidate, community)
    end)

    change(fn canonical, operation_ref ->
      with {:ok, result} <- BindingTrashPersist.restore(canonical, community, trash_id, revision),
           {:ok, :pass} <-
             CommunityTrashSupport.effects(
               result,
               canonical,
               community,
               actor,
               :restored,
               operation_ref
             ) do
        {:ok, {result, canonical}}
      end
    end)

    confirm(fn {result, canonical} ->
      {:ok, CommunityTrashSupport.confirmation(result, canonical, command_id)}
    end)

    present(&CommunityTrashSupport.present/1)
  end
end
