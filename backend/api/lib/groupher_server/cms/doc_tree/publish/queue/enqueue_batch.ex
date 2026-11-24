defmodule GroupherServer.CMS.DocTree.Publish.Queue.EnqueueBatch do
  @moduledoc """
  Enqueues Doc copies and their required navigation nodes atomically.

    The caller owns the transaction and site admission and must roll back errors.

      Enqueue command -> EnqueueBatch -> Gate / Queue / tree reconciliation
  """

  import Ecto.Query

  alias GroupherServer.{Accounts, CMS, Repo}
  alias Accounts.Model.User
  alias CMS.DocTree.Publish.{Queue, TargetTree, TreeCodec}
  alias CMS.DocTree.Publish.Queue.{Dependencies, Tree}
  alias CMS.Model.{Article, Community, DocsPublishQueue, DocsQueueTreeChange, DocsTreeNode}

  @fields ~w(node_id type parent_node_id index title href doc_id marker badge hidden)a

  @doc "Enqueues a checked batch and advances the Queue revision once."
  def run(
        %Community{} = community,
        %DocsPublishQueue{} = queue,
        revision,
        entries,
        %User{} = actor,
        command_id,
        operation_ref
      )
      when is_integer(revision) and revision >= 0 and is_list(entries) do
    with {:ok, ids} <- ids(entries),
         {:ok, queue} <- Queue.advance(community, queue, %{queue_revision: revision}, []),
         {:ok, :pass} <- authorize(community, ids, actor),
         public <- nodes(community, :public),
         draft <- nodes(community, :draft),
         changes <- changes(queue),
         {:ok, decoded} <- TreeCodec.decode_changes(changes),
         {:ok, current} <- TargetTree.build(public, decoded),
         {:ok, target} <- Dependencies.target(public, draft, current, ids),
         {:ok, result} <-
           Queue.enqueue(community, queue, revision, entries, actor, command_id, operation_ref),
         {:ok, _} <-
           Tree.reconcile_after_content(
             community,
             result.queue,
             result.queue.queue_revision,
             public,
             target,
             actor,
             operation_ref
           ) do
      {:ok, result}
    end
  end

  @doc "Rejects batch enqueue requests that do not provide valid Queue revision and entries."
  def run(_, _, _, _, _, _), do: {:error, :invalid_queue_members}

  defp ids([]), do: {:error, :invalid_queue_members}

  defp ids(entries) do
    Enum.reduce_while(entries, {:ok, MapSet.new()}, fn entry, {:ok, ids} ->
      with %{article_id: id, default_revision: revision} <- entry,
           {:ok, id} <- Ecto.UUID.cast(id),
           true <- is_integer(revision) and revision > 0,
           false <- MapSet.member?(ids, id) do
        {:cont, {:ok, MapSet.put(ids, id)}}
      else
        _ -> {:halt, {:error, :invalid_queue_members}}
      end
    end)
    |> case do
      {:ok, ids} -> {:ok, ids |> MapSet.to_list() |> Enum.sort()}
      error -> error
    end
  end

  defp authorize(community, ids, actor) do
    articles =
      Repo.all(from(a in Article, where: a.id in ^ids, order_by: a.id, lock: "FOR UPDATE"))

    if length(articles) != length(ids) do
      {:error, :invalid_doc_identity}
    else
      Enum.reduce_while(articles, {:ok, :pass}, fn article, _ ->
        case CMS.Gate.Access.Check.with_authorized_article_binding(
               actor,
               :edit,
               {community, article},
               fn _ -> {:ok, :pass} end
             ) do
          {:ok, :pass} -> {:cont, {:ok, :pass}}
          {:error, _reason} = error -> {:halt, error}
        end
      end)
    end
  end

  defp nodes(community, stage) do
    Repo.all(
      from(n in DocsTreeNode,
        where: n.community_id == ^community.id and n.stage == ^stage,
        order_by: n.node_id,
        lock: "FOR SHARE"
      )
    )
    |> Enum.map(&Map.take(&1, @fields))
  end

  defp changes(queue) do
    Repo.all(
      from(c in DocsQueueTreeChange,
        where: c.queue_id == ^queue.id,
        order_by: c.node_id,
        lock: "FOR UPDATE"
      )
    )
  end
end
