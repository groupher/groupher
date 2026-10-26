defmodule GroupherServer.CMS.Articles.Commands.CommentLock do
  @moduledoc """
  Owns Gate admission and lock state changes for Article comments.

      comment command -> Gate admission -> lock transition -> tagged result
  """

  use GroupherServer.CommandPipeline,
    adapter: GroupherServer.CMS.CommandPipelineAdapter

  alias GroupherServer.CMS
  alias CMS.Articles.{Bindings, States}
  alias CMS.Docs.Store, as: DocStore
  alias CMS.FrontDesk
  alias CMS.Gate.ErrorCat, as: GateErrorCat
  alias CMS.Model.{Article, Community}

  @spec execute(Ecto.UUID.t(), struct(), atom(), keyword()) :: {:ok, term()} | {:error, term()}
  def execute(article_id, actor, :lock_comments, opts) do
    lock_comments(article_id, actor, opts)
  end

  def execute(article_id, actor, :undo_lock_comments, opts) do
    unlock_comments(article_id, actor, opts)
  end

  @pipeline operation: :article_lock_comments, target: :article_id
  direct_pipeline lock_comments(article_id, actor, opts) do
    gate(fn _candidate -> authorize(article_id, actor, :lock_comments, opts) end)

    change(fn {canonical, branch_id} ->
      change_opts = if is_integer(branch_id), do: [branch_id: branch_id], else: opts
      States.lock_comments(canonical, change_opts)
    end)
  end

  @pipeline operation: :article_unlock_comments, target: :article_id
  direct_pipeline unlock_comments(article_id, actor, opts) do
    gate(fn _candidate -> authorize(article_id, actor, :undo_lock_comments, opts) end)

    change(fn {canonical, branch_id} ->
      change_opts = if is_integer(branch_id), do: [branch_id: branch_id], else: opts
      States.undo_lock_comments(canonical, change_opts)
    end)
  end

  defp authorize(article_id, actor, action, opts) do
    gate_action = if action == :undo_lock_comments, do: :unlock_comments, else: action

    case FrontDesk.article(article_id, mode: :internal) do
      {:ok, %Article{thread: :doc} = article} ->
        with {:ok, community} <- resolve_community(opts, article) do
          branch_id = Keyword.get(opts, :branch_id) || main_branch_id(community.id)

          with {:ok, canonical} <-
                 CMS.Gate.check_in_transaction(
                   actor,
                   gate_action,
                   article,
                   community,
                   branch_id
                 ) do
            {:ok, {canonical, branch_id}}
          end
        end

      {:ok, %Article{} = article} ->
        with {:ok, community} <- resolve_community(opts, article) do
          with {:ok, canonical} <-
                 CMS.Gate.check_in_transaction(actor, gate_action, article, community) do
            {:ok, {canonical, nil}}
          end
        end

      {:error, _} ->
        {:error, GateErrorCat.resource_not_found()}
    end
  end

  defp resolve_community(opts, article) do
    case Keyword.get(opts, :community) do
      %Community{} = community ->
        {:ok, community}

      _ ->
        case Keyword.get(opts, :community_id) do
          community_id when is_integer(community_id) ->
            case FrontDesk.community(community_id, mode: :internal) do
              {:ok, %Community{} = community} -> {:ok, community}
              {:error, _reason} -> {:error, CMS.Communities.ErrorCat.not_exist()}
            end

          _ ->
            resolve_branch_community(opts, article)
        end
    end
  end

  defp resolve_branch_community(opts, article) do
    case Keyword.get(opts, :branch_id) do
      branch_id when is_integer(branch_id) ->
        with {:ok, %{community_id: community_id}} <- CMS.Docs.Store.branch_context(branch_id),
             {:ok, community} <- FrontDesk.community(community_id, mode: :internal) do
          {:ok, community}
        end

      _ ->
        case Bindings.get(article, Map.get(article, :community)) do
          {:ok, %{community: community}} -> {:ok, community}
          {:error, reason} -> {:error, reason}
        end
    end
  end

  defp main_branch_id(community_id) do
    case DocStore.branch(community_id, :main) do
      {:ok, %{id: branch_id}} -> branch_id
      {:error, _} -> nil
    end
  end
end
