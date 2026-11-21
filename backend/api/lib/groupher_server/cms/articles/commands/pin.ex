defmodule GroupherServer.CMS.Articles.Commands.Pin do
  @moduledoc """
  Pins one ordinary Article binding after authorization and capacity validation.

      CMS.Articles.pin -> CMS.Command -> Gate -> capacity check -> PinnedArticle
  """

  use GroupherServer.CommandPipeline,
    adapter: GroupherServer.CMS.CommandPipelineAdapter

  alias GroupherServer.{Accounts, CMS}
  alias Accounts.Model.User
  alias CMS.Articles.Commands.{BindingConfirmation, BindingSupport}
  alias CMS.Articles.PinPersist
  alias CMS.Model.Community

  @doc "Executes or replays one authorized Community-local pin command."
  def execute(community, article_id, %User{} = actor, command_id) do
    with {:ok, article} <- BindingSupport.load_article(article_id),
         {:ok, :supported} <- BindingSupport.ensure_ordinary(article) do
      execute_pipeline(article, community, community.id, actor, command_id)
    end
  end

  @pipeline operation: :article_pin,
            confirmation: BindingConfirmation,
            target: :article,
            params: [:community_id]

  receipt_pipeline execute_pipeline(article, community, community_id, actor, command_id) do
    gate(fn candidate -> CMS.Gate.check_in_transaction(actor, :pin, candidate, community) end)

    change(fn canonical, _operation_ref ->
      with %Community{} = locked_community <- PinPersist.lock_community(community.id),
           {:ok, :pass} <- ensure_capacity(locked_community.id, canonical.thread),
           {:ok, _pin} <- PinPersist.insert(canonical, locked_community) do
        {:ok, {canonical, locked_community}}
      end
    end)

    confirm(fn {canonical, locked_community} ->
      {:ok, BindingSupport.confirmation(canonical, locked_community, command_id)}
    end)

    present(fn confirmation -> BindingSupport.present_article({:ok, confirmation}) end)
  end

  defp ensure_capacity(community_id, thread) do
    count = PinPersist.count(community_id, thread)

    if count < Community.max_pinned_article_count_per_thread() do
      {:ok, :pass}
    else
      {:error, CMS.Articles.ErrorCat.too_much_pinned_article("too much pinned article")}
    end
  end
end
