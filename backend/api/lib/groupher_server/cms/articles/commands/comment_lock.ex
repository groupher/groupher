defmodule GroupherServer.CMS.Articles.Commands.CommentLock do
  @moduledoc """
  Owns Gate admission and lock state changes for Article comments.

      comment command -> Gate admission -> lock transition -> tagged result
  """

  use GroupherServer.CommandPipeline,
    adapter: GroupherServer.CMS.CommandPipelineAdapter

  alias GroupherServer.CMS
  alias CMS.Articles.States
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

    change(fn canonical ->
      States.lock_comments(canonical, opts)
    end)
  end

  @pipeline operation: :article_unlock_comments, target: :article_id
  direct_pipeline unlock_comments(article_id, actor, opts) do
    gate(fn _candidate -> authorize(article_id, actor, :undo_lock_comments, opts) end)

    change(fn canonical ->
      States.undo_lock_comments(canonical, opts)
    end)
  end

  defp authorize(article_id, actor, action, opts) do
    gate_action = if action == :undo_lock_comments, do: :unlock_comments, else: action

    case FrontDesk.article(article_id, mode: :internal) do
      {:ok, %Article{} = article} ->
        with {:ok, community} <- resolve_community(opts, article) do
          with {:ok, canonical} <-
                 CMS.Gate.check_in_transaction(actor, gate_action, article, community) do
            {:ok, canonical}
          end
        end

      {:error, _} ->
        {:error, GateErrorCat.resource_not_found()}
    end
  end

  defp resolve_community(opts, _article) do
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
            {:error, CMS.Articles.ErrorCat.binding_context_required()}
        end
    end
  end
end
