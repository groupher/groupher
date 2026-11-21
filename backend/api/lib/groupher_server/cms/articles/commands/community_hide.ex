defmodule GroupherServer.CMS.Articles.Commands.CommunityHide do
  @moduledoc """
  Hides one non-Doc Binding through a Receipt-protected Community command.

      Community + Article -> Gate -> local Trash -> Activity / Outbox -> Receipt
  """
  use GroupherServer.CommandPipeline, adapter: GroupherServer.CMS.CommandPipelineAdapter
  alias GroupherServer.{Accounts, CMS}
  alias Accounts.Model.User
  alias CMS.Articles.BindingTrashPersist
  alias CMS.Articles.Commands.{CommunityTrashConfirmation, CommunityTrashSupport}
  alias CMS.Model.Community

  def execute(%Community{} = community, article_id, %User{} = actor, command_id) do
    with {:ok, article} <- CommunityTrashSupport.load_article(article_id) do
      run(article, community, community.id, actor, command_id)
    end
  end

  def execute(_, _, _, _), do: {:error, :invalid_article_binding}

  @pipeline operation: :community_article_hide,
            confirmation: CommunityTrashConfirmation,
            target: :article,
            params: [:community_id]
  receipt_pipeline run(article, community, community_id, actor, command_id) do
    gate(fn candidate ->
      CMS.Gate.check_in_transaction(actor, :community_hide, candidate, community)
    end)

    change(fn canonical, operation_ref ->
      with {:ok, result} <- BindingTrashPersist.hide(canonical, community, actor),
           {:ok, :pass} <-
             CommunityTrashSupport.effects(
               result,
               canonical,
               community,
               actor,
               :trashed,
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
