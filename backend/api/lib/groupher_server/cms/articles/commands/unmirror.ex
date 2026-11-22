defmodule GroupherServer.CMS.Articles.Commands.Unmirror do
  @moduledoc """
  Removes one ordinary Article binding while preserving the stable Article.

      CMS.Articles.unmirror -> CMS.Command -> Gate -> BindingPersist -> done
  """

  use GroupherServer.CommandPipeline,
    adapter: GroupherServer.CMS.CommandPipelineAdapter

  alias GroupherServer.{Accounts, CMS}
  alias Accounts.Model.User
  alias CMS.Articles.{BindingPersist, Store}
  alias CMS.Articles.Commands.{BindingConfirmation, BindingSupport}

  @doc "Executes or replays one authorized unmirror command."
  def execute(community, article_id, %User{} = actor, command_id) do
    with {:ok, article} <- BindingSupport.load_article(article_id),
         {:ok, :supported} <- BindingSupport.ensure_ordinary(article) do
      execute_pipeline(article, community, community.id, actor, command_id)
    end
  end

  @pipeline operation: :article_unmirror,
            confirmation: BindingConfirmation,
            target: :article,
            params: [:community_id]

  receipt_pipeline execute_pipeline(article, community, community_id, actor, command_id) do
    gate(fn candidate ->
      CMS.Gate.check_in_transaction(actor, :unmirror, candidate, community)
    end)

    change(fn canonical, operation_ref ->
      with {:ok, binding} <- Store.binding(canonical.id, community.id),
           {:ok, :done} <- BindingPersist.unmirror(canonical, community),
           {:ok, _} <-
             BindingSupport.invalidate_scope(community, binding, canonical.thread, operation_ref) do
        {:ok, canonical}
      end
    end)

    confirm(fn canonical ->
      {:ok, BindingSupport.confirmation(canonical, community, command_id)}
    end)

    present(fn confirmation -> BindingSupport.present_done({:ok, confirmation}) end)
  end
end
