defmodule GroupherServer.CMS.Articles.Commands.Moderate do
  @moduledoc """
  Owns Gate admission for Article moderation state changes.

      moderation command -> canonical Article -> Gate -> moderation write
  """

  alias GroupherServer.CMS
  alias CMS.Articles.Moderation
  alias CMS.Docs.Store, as: DocStore
  alias CMS.FrontDesk
  alias CMS.Gate.ErrorCat, as: GateErrorCat
  alias CMS.Model.Article

  @spec execute(Ecto.UUID.t(), atom(), map(), struct() | :operations, keyword()) ::
          {:ok, term()} | {:error, term()}
  def execute(article_id, state, attrs, actor, opts) do
    case FrontDesk.article(article_id, mode: :internal) do
      {:ok, %Article{thread: :doc} = article} ->
        branch_id = Keyword.get(opts, :branch_id) || main_branch_id(article.community_id)

        CMS.Gate.Access.with_branch_check(actor, :moderate, article, branch_id, fn canonical ->
          Moderation.set_state(canonical, state, attrs, branch_id: branch_id)
        end)

      {:ok, %Article{} = article} ->
        CMS.Gate.Access.with_check(actor, :moderate, article, fn canonical ->
          Moderation.set_state(canonical, state, attrs, opts)
        end)

      {:error, _} ->
        {:error, GateErrorCat.resource_not_found()}
    end
  end

  defp main_branch_id(community_id) do
    case DocStore.branch(community_id, :main) do
      {:ok, %{id: branch_id}} -> branch_id
      {:error, _} -> nil
    end
  end
end
