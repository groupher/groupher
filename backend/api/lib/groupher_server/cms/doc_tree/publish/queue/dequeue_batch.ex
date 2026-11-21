defmodule GroupherServer.CMS.DocTree.Publish.Queue.DequeueBatch do
  @moduledoc """
  Removes Queue copies and unused draft-only directory dependencies atomically.

      Dequeue command -> DequeueBatch -> member removal and tree reconciliation
  """

  import Ecto.Query
  alias GroupherServer.{Accounts, CMS, Repo}
  alias Accounts.Model.User
  alias CMS.DocTree.Publish.{Queue, TargetTree, TreeCodec, TreeOrder}
  alias CMS.DocTree.Publish.Queue.{Dequeue, Tree}
  alias CMS.Model.{Article, Community, DocsPublishQueue, DocsQueueTreeChange, DocsTreeNode}

  @fields ~w(node_id type parent_node_id index title href doc_id marker badge hidden)a

  @doc "Checks the exact discard confirmation required for the supplied Queue revision."
  def preview(
        %Community{} = community,
        %DocsPublishQueue{} = queue,
        revision,
        ids,
        %User{} = actor
      )
      when is_integer(revision) and revision >= 0 and is_list(ids) do
    with {:ok, ids} <- Dequeue.normalize_ids(ids),
         {:ok, queue} <- Queue.advance(community, queue, %{queue_revision: revision}, []),
         {:ok, :pass} <- authorize(community, ids, actor),
         {:ok, locked} <- Dequeue.load_locked(community, queue, ids) do
      case Queue.check_discard(operation(ids), revision, locked.documents) do
        {:ok, _} ->
          {:ok, %{requires_confirmation: false, confirmation: nil, documents: []}}

        {:error, {:discard_confirmation_required, detail}} ->
          {:ok,
           %{
             requires_confirmation: true,
             confirmation: detail.confirmation,
             documents: detail.documents
           }}

        {:error, _reason} = error ->
          error
      end
    end
  end

  def preview(_, _, _, _, _), do: {:error, :invalid_queue_members}

  @doc "Removes an admitted member batch and reconciles its directory dependencies."
  def run(
        %Community{} = community,
        %DocsPublishQueue{} = queue,
        revision,
        ids,
        confirmation,
        %User{} = actor,
        operation_ref
      )
      when is_integer(revision) and revision >= 0 and is_list(ids) do
    with {:ok, ids} <- Dequeue.normalize_ids(ids),
         {:ok, queue} <- Queue.advance(community, queue, %{queue_revision: revision}, []),
         {:ok, :pass} <- authorize(community, ids, actor),
         public <- public_nodes(community),
         {:ok, changes} <- queue_changes(queue) |> TreeCodec.decode_changes(),
         {:ok, current} <- TargetTree.build(public, changes),
         {:ok, target} <- remove_dependencies(public, current, ids),
         {:ok, removed} <-
           Queue.remove_many(
             community,
             queue,
             revision,
             ids,
             operation(ids),
             confirmation,
             operation_ref
           ),
         {:ok, _} <-
           Tree.reconcile_after_content(
             community,
             removed.queue,
             removed.queue.queue_revision,
             public,
             target,
             actor,
             operation_ref
           ) do
      {:ok, removed}
    end
  end

  def run(_, _, _, _, _, _), do: {:error, :invalid_queue_members}

  defp operation(ids), do: %{"kind" => "dequeue", "article_ids" => ids}

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

  defp remove_dependencies(public, current, article_ids) do
    public_pages = public |> Enum.filter(&(&1.type == :page)) |> MapSet.new(& &1.doc_id)

    removed =
      current
      |> Enum.filter(
        &(&1.type == :page and &1.doc_id in article_ids and
            not MapSet.member?(public_pages, &1.doc_id))
      )
      |> MapSet.new(& &1.node_id)

    public_ids = MapSet.new(public, & &1.node_id)
    removed = prune_empty_parents(current, public_ids, removed)

    if MapSet.size(removed) == 0 do
      {:ok, current}
    else
      with {:ok, %{target: target}} <- TreeOrder.remove(current, MapSet.to_list(removed)) do
        {:ok, target}
      end
    end
  end

  defp prune_empty_parents(nodes, public_ids, removed) do
    parents =
      nodes
      |> Enum.filter(&MapSet.member?(removed, &1.node_id))
      |> Enum.map(& &1.parent_node_id)
      |> Enum.reject(&is_nil/1)
      |> MapSet.new()

    empty =
      nodes
      |> Enum.filter(fn node ->
        node.type in [:tab, :group] and MapSet.member?(parents, node.node_id) and
          not MapSet.member?(public_ids, node.node_id) and
          not MapSet.member?(removed, node.node_id) and
          Enum.all?(
            nodes,
            &(&1.parent_node_id != node.node_id or MapSet.member?(removed, &1.node_id))
          )
      end)
      |> Enum.map(& &1.node_id)

    if empty == [] do
      removed
    else
      prune_empty_parents(nodes, public_ids, Enum.reduce(empty, removed, &MapSet.put(&2, &1)))
    end
  end

  defp public_nodes(community) do
    Repo.all(
      from(n in DocsTreeNode,
        where: n.community_id == ^community.id and n.stage == :public,
        order_by: n.node_id,
        lock: "FOR SHARE"
      )
    )
    |> Enum.map(&Map.take(&1, @fields))
  end

  defp queue_changes(queue) do
    Repo.all(
      from(c in DocsQueueTreeChange,
        where: c.queue_id == ^queue.id,
        order_by: c.node_id,
        lock: "FOR UPDATE"
      )
    )
  end
end
