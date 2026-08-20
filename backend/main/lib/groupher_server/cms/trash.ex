defmodule GroupherServer.CMS.Trash do
  @moduledoc """
  Small coordinator for action-level Trash operations.

  Article lifecycle remains in `CMS.Articles.Trash`; Docs Tree placement stays
  in `CMS.DocTree.Trash`. This module only routes an action and drives the due
  action scan used by the scheduler.

  Business position:

      GraphQL resolver / job
        -> CMS facade
        -> Trash
        -> Repo / external boundary
  """

  import Ecto.Query, warn: false

  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.{CMS, Repo}
  alias GroupherServer.CMS.Model.{TrashAction, TrashedArticle}
  alias Helper.T

  @default_batch_size 50

  @spec get_action(Ecto.UUID.t()) :: T.domain_res(TrashAction.t())
  @doc "Returns action through the `Trash` boundary."
  def get_action(ref) do
    case Repo.get_by(TrashAction, hash_id: ref) do
      %TrashAction{} = action -> {:ok, action}
      nil -> {:error, CMS.Articles.ErrorCat.not_exist("TrashAction")}
    end
  end

  @spec action_thread(TrashAction.t()) :: {:ok, atom()} | {:error, term()}
  @doc "Runs `action_thread` through the public `Trash` boundary."
  def action_thread(%TrashAction{root_type: root_type} = action) do
    cond do
      String.starts_with?(root_type, "doc_tree_") ->
        {:ok, :doc}

      root_type == "article" ->
        case Repo.get_by(TrashedArticle, trash_action_id: action.id) do
          %TrashedArticle{thread: thread} -> {:ok, thread}
          nil -> {:error, CMS.Articles.ErrorCat.not_exist("TrashedArticle")}
        end

      true ->
        {:error, GroupherServer.ErrorCat.custom("Unsupported Trash action type: #{root_type}")}
    end
  end

  @spec permanently_delete_action(TrashAction.t() | Ecto.UUID.t(), User.t() | nil, keyword()) ::
          T.domain_res(map())
  @doc "Runs `permanently_delete_action` through the public `Trash` boundary."
  def permanently_delete_action(action_or_ref, actor \\ nil, opts \\ [])

  def permanently_delete_action(%TrashAction{} = action, actor, opts) do
    cond do
      String.starts_with?(action.root_type, "doc_tree_") ->
        CMS.DocTree.Trash.permanently_delete_action(action, actor, opts)

      action.root_type == "article" ->
        permanently_delete_article_action(action, actor, opts)

      true ->
        {:error,
         GroupherServer.ErrorCat.custom("Unsupported Trash action type: #{action.root_type}")}
    end
  end

  def permanently_delete_action(ref, actor, opts) when is_binary(ref) do
    with {:ok, action} <- get_action(ref) do
      permanently_delete_action(action, actor, opts)
    end
  end

  @doc "Permanently deletes due actions in bounded, independently retriable units."
  @spec purge_due(keyword()) :: T.domain_res(map())
  def purge_due(opts \\ []) do
    now = Keyword.get(opts, :now, DateTime.utc_now(:second))
    size = Keyword.get(opts, :size, @default_batch_size)

    actions =
      TrashAction
      |> where([action], action.scheduled_permanent_deletion_at <= ^now)
      |> order_by([action], asc: action.scheduled_permanent_deletion_at, asc: action.id)
      |> limit(^size)
      |> Repo.all()

    Enum.reduce(actions, %{deleted: 0, failed: []}, fn action, result ->
      case permanently_delete_action(action, nil, source: "scheduler") do
        {:ok, _} ->
          %{result | deleted: result.deleted + 1}

        {:error, reason} ->
          %{result | failed: [%{action: action.hash_id, reason: reason} | result.failed]}
      end
    end)
    |> then(fn result -> {:ok, %{result | failed: Enum.reverse(result.failed)}} end)
  end

  defp permanently_delete_article_action(action, actor, opts) do
    case Repo.get_by(TrashedArticle, trash_action_id: action.id) do
      %TrashedArticle{} = item ->
        CMS.Articles.Trash.permanently_delete(item, actor, opts)

      nil ->
        CMS.Articles.Trash.delete_empty_action(action.id)
        {:ok, %{done: true}}
    end
  end
end
