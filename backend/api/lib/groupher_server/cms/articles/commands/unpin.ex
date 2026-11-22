defmodule GroupherServer.CMS.Articles.Commands.Unpin do
  @moduledoc """
  Removes one Community-local ordinary Article pin.

      CMS.Articles.undo_pin -> CMS.Command -> Gate -> delete PinnedArticle -> done
  """

  use GroupherServer.CommandPipeline,
    adapter: GroupherServer.CMS.CommandPipelineAdapter

  alias GroupherServer.{Accounts, CMS}
  alias Accounts.Model.User
  alias CMS.Articles.Commands.{BindingConfirmation, BindingSupport}
  alias CMS.Articles.PinPersist

  @doc "Executes or replays one authorized Community-local unpin command."
  def execute(community, article_id, %User{} = actor, command_id) do
    with {:ok, article} <- BindingSupport.load_article(article_id),
         {:ok, :supported} <- BindingSupport.ensure_ordinary(article) do
      execute_pipeline(article, community, community.id, actor, command_id)
    end
  end

  @pipeline operation: :article_unpin,
            confirmation: BindingConfirmation,
            target: :article,
            params: [:community_id]

  receipt_pipeline execute_pipeline(article, community, community_id, actor, command_id) do
    gate(fn candidate -> CMS.Gate.check_in_transaction(actor, :unpin, candidate, community) end)

    change(fn canonical, _operation_ref ->
      with {:ok, :done} <- PinPersist.delete(canonical.id, community.id) do
        {:ok, canonical}
      end
    end)

    confirm(fn canonical ->
      {:ok, BindingSupport.confirmation(canonical, community, command_id)}
    end)

    present(fn confirmation -> BindingSupport.present_done({:ok, confirmation}) end)
  end
end
