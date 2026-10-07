defmodule GroupherServer.CMS.Articles.Commands.CommentLock do
  @moduledoc """
  Owns Gate admission and lock state changes for Article comments.

      comment command -> Gate admission -> lock transition -> tagged result
  """

  alias GroupherServer.CMS
  alias CMS.Articles.States
  alias CMS.Docs.Store, as: DocStore
  alias CMS.FrontDesk
  alias CMS.Gate.ErrorCat, as: GateErrorCat
  alias CMS.Model.Article

  @spec execute(Ecto.UUID.t(), struct(), atom(), keyword()) :: {:ok, term()} | {:error, term()}
  def execute(article_id, actor, action, opts) do
    gate_action = if action == :undo_lock_comments, do: :unlock_comments, else: action

    case FrontDesk.article(article_id, mode: :internal) do
      {:ok, %Article{thread: :doc} = article} ->
        branch_id = Keyword.get(opts, :branch_id) || main_branch_id(article.community_id)

        CMS.Gate.Access.with_branch_check(actor, gate_action, article, branch_id, fn canonical ->
          apply(States, action, [canonical, [branch_id: branch_id]])
        end)

      {:ok, %Article{} = article} ->
        CMS.Gate.Access.with_check(actor, gate_action, article, fn canonical ->
          apply(States, action, [canonical, opts])
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
