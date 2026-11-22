defmodule GroupherServer.CMS.DocTree.WorkspaceRestore do
  @moduledoc """
  Restores a complete Docs Trash action under the caller's site lock.

    Before deletion is released the saved Queue tree is reinstated. After a
    release only the working tree returns; content must be enqueued again.

      RestoreWorkspaceNode command -> WorkspaceRestore -> draft and Queue tree
  """
  import Ecto.Query
  alias GroupherServer.{Accounts, CMS, Repo}
  alias Accounts.Model.User
  alias CMS.DocTree.Publish.{Queue, TargetTree, TreeCodec, TreeOrder}
  alias CMS.DocTree.{Publish.Queue.Dependencies, WorkspacePersist}
  alias CMS.Model.{Article, ArticleLifecycle, ArticlePublic, Community, DocsPublishQueue}

  alias CMS.Model.{
    DocsQueueTreeChange,
    DocsTreeNode,
    DocsTrashedArticle,
    DocsTrashedTreeNode,
    TrashAction
  }

  @fields ~w(node_id type parent_node_id index title href doc_id marker badge hidden)a

  @doc "Restores all nodes and Doc members of one Trash action, or rolls back completely."
  def run(
        %Community{} = community,
        %DocsPublishQueue{} = queue,
        tree_revision,
        queue_revision,
        action_id,
        target_parent,
        target_index,
        %User{} = actor,
        operation_ref
      )
      when is_integer(tree_revision) and tree_revision >= 0 and is_integer(queue_revision) and
             queue_revision >= 0 and is_binary(action_id) and
             (is_nil(target_parent) or is_binary(target_parent) or
                target_parent == :restore_original) and
             (is_nil(target_index) or (is_integer(target_index) and target_index >= 0)) and
             (is_nil(target_index) or target_parent != :restore_original) do
    with {:ok, action_id} <- Ecto.UUID.cast(action_id),
         {:ok, queue} <-
           Queue.advance(
             community,
             queue,
             %{tree_lock_version: tree_revision, queue_revision: queue_revision},
             []
           ),
         %TrashAction{} = action <-
           Repo.one(
             from(a in TrashAction,
               where:
                 a.hash_id == ^action_id and a.community_id == ^community.id and
                   a.root_type == "doc_tree_node",
               lock: "FOR UPDATE"
             )
           ),
         entries <-
           Repo.all(
             from(n in DocsTrashedTreeNode,
               where: n.trash_action_id == ^action.id and n.community_id == ^community.id,
               order_by: n.node_id,
               lock: "FOR UPDATE"
             )
           ),
         docs <-
           Repo.all(
             from(d in DocsTrashedArticle,
               where: d.trash_action_id == ^action.id and d.community_id == ^community.id,
               order_by: d.article_id,
               lock: "FOR UPDATE"
             )
           ),
         true <- entries != [],
         {:ok, :pass} <- authorize(community, docs, actor),
         rows <- WorkspacePersist.lock_nodes(community),
         draft <- Enum.map(rows, &Map.take(&1, @fields)),
         {:ok, saved_draft} <- decode(entries, :draft_snapshot),
         {:ok, saved_queue} <- decode(entries, :queue_snapshot),
         {:ok, :pass} <- validate_entries(action, entries, docs, saved_draft, saved_queue),
         {:ok, saved_draft} <- relocate(saved_draft, action.root_ref, target_parent, target_index),
         {:ok, target_draft} <- insert_nodes(draft, saved_draft),
         public <- nodes(community, :public),
         {:ok, changes} <- changes(queue) |> TreeCodec.decode_changes(),
         {:ok, current} <- TargetTree.build(public, changes),
         wanted <- queued_restore(saved_queue, public),
         {:ok, wanted} <- relocate(wanted, action.root_ref, target_parent, target_index),
         {:ok, prepared} <-
           prepare_parent(public, target_draft, current, wanted, action.root_ref, target_parent),
         {:ok, target_queue} <- insert_nodes(prepared, wanted),
         {:ok, :pass} <- authorize_queue(community, current != target_queue, actor),
         restored_ids <- Enum.map(docs, & &1.article_id),
         affected <-
           (changed_pages(draft, target_draft) ++ changed_pages(current, target_queue))
           |> Enum.uniq()
           |> Kernel.--(restored_ids)
           |> Enum.sort(),
         {:ok, :pass} <- authorize_survivors(community, affected, actor),
         {:ok, :pass} <- restore_lifecycles(community, docs),
         {:ok, :pass} <- save_workspace(community, rows, draft, target_draft),
         {:ok, queue} <-
           Queue.advance(
             community,
             queue,
             %{tree_lock_version: tree_revision},
             [
               :tree_lock_version
             ],
             operation_ref
           ),
         {:ok, queue} <-
           reconcile(community, queue, public, current, target_queue, actor, operation_ref),
         {:ok, :pass} <- remove_trash(action, entries, docs) do
      {:ok,
       %{
         tree_revision: queue.tree_lock_version,
         queue_revision: queue.queue_revision,
         node_id: action.root_ref
       }}
    else
      nil -> {:error, :trash_action_not_found}
      false -> {:error, :invalid_trash_action}
      :error -> {:error, :invalid_trash_action}
      {:error, _} = error -> error
    end
  end

  def run(_, _, _, _, _, _, _, _, _), do: {:error, :invalid_tree_input}

  defp relocate(nodes, _root_id, :restore_original, nil), do: {:ok, nodes}

  defp relocate(nodes, root_id, parent, index) do
    case Enum.find(nodes, &(&1.node_id == root_id)) do
      nil ->
        {:ok, nodes}

      %{type: :tab} ->
        {:error, :invalid_restore_parent}

      root ->
        replacement = %{root | parent_node_id: parent, index: index || root.index}

        {:ok,
         Enum.map(nodes, fn node -> if node.node_id == root_id, do: replacement, else: node end)}
    end
  end

  defp prepare_parent(_public, _draft, current, _wanted, _root, parent)
       when parent in [nil, :restore_original],
       do: {:ok, current}

  defp prepare_parent(public, draft, current, wanted, root, parent) do
    if Enum.any?(wanted, &(&1.node_id == root)) do
      Dependencies.ensure_parent(public, draft, current, parent)
    else
      {:ok, current}
    end
  end

  defp authorize(community, docs, actor) do
    ids = Enum.map(docs, & &1.article_id)

    articles =
      Repo.all(from(a in Article, where: a.id in ^ids, order_by: a.id, lock: "FOR UPDATE"))

    if length(articles) != length(ids) do
      {:error, :invalid_doc_identity}
    else
      Enum.reduce_while(articles, {:ok, :pass}, fn article, _ ->
        case CMS.Gate.Access.Check.with_authorized_article_binding(
               actor,
               :restore,
               {community, article},
               fn _ -> {:ok, :pass} end
             ) do
          {:ok, :pass} -> {:cont, {:ok, :pass}}
          {:error, _} = error -> {:halt, error}
        end
      end)
    end
  end

  defp validate_entries(action, entries, docs, draft, queued) do
    by_id = Map.new(entries, &{&1.node_id, &1})

    content_ids =
      draft |> Enum.filter(&(&1.type == :page)) |> Enum.map(& &1.doc_id) |> Enum.sort()

    doc_ids = docs |> Enum.map(& &1.article_id) |> Enum.sort()

    valid_nodes =
      Enum.all?(draft ++ queued, fn node ->
        case by_id[node.node_id] do
          %DocsTrashedTreeNode{type: type, doc_id: doc_id} ->
            node.type == type and node.doc_id == doc_id

          _ ->
            false
        end
      end)

    if Enum.any?(draft, &(&1.node_id == action.root_ref)) and content_ids == doc_ids and
         valid_nodes do
      {:ok, :pass}
    else
      {:error, :invalid_trash_action}
    end
  end

  defp changed_pages(before, after_nodes) do
    prior = Map.new(before, &{&1.node_id, &1})
    changed = after_nodes |> Enum.filter(&(prior[&1.node_id] != &1)) |> MapSet.new(& &1.node_id)
    selected = descendants(after_nodes, changed)

    after_nodes
    |> Enum.filter(&(&1.type == :page and MapSet.member?(selected, &1.node_id)))
    |> Enum.map(& &1.doc_id)
  end

  defp descendants(nodes, ids) do
    next =
      Enum.reduce(nodes, ids, fn node, acc ->
        if MapSet.member?(ids, node.parent_node_id), do: MapSet.put(acc, node.node_id), else: acc
      end)

    if MapSet.equal?(ids, next), do: ids, else: descendants(nodes, next)
  end

  defp authorize_survivors(community, ids, actor) do
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
          {:error, _} = error -> {:halt, error}
        end
      end)
    end
  end

  defp decode(entries, field) do
    entries
    |> Enum.flat_map(fn entry ->
      case Map.get(entry, field) do
        nil ->
          []

        %{"node_id" => id} = snapshot when id == entry.node_id ->
          [%{node_id: id, change_type: :upsert, target: Map.delete(snapshot, "node_id")}]

        _ ->
          [%{node_id: entry.node_id, change_type: :invalid, target: nil}]
      end
    end)
    |> TreeCodec.decode_changes()
    |> case do
      {:ok, changes} -> {:ok, Enum.map(changes, &Map.put(&1.target, :node_id, &1.node_id))}
      {:error, _} = error -> error
    end
  end

  defp insert_nodes(nodes, []), do: {:ok, nodes}

  defp insert_nodes(nodes, pending) do
    by_id = Map.new(nodes, &{&1.node_id, &1})

    case Enum.find(Enum.sort_by(pending, &{&1.index, &1.node_id}), fn node ->
           is_nil(node.parent_node_id) or Map.has_key?(by_id, node.parent_node_id)
         end) do
      nil ->
        {:error, CMS.ErrorCat.docs_restore_parent_missing()}

      node ->
        with nil <- Map.get(by_id, node.node_id),
             {:ok, %{target: target}} <- TreeOrder.insert(nodes, node, node.index) do
          insert_nodes(target, List.delete(pending, node))
        else
          %{} -> {:error, :restore_node_conflict}
          {:error, _} = error -> error
        end
    end
  end

  defp queued_restore(saved, public) do
    public_ids = MapSet.new(public, & &1.node_id)

    if Enum.any?(saved, &MapSet.member?(public_ids, &1.node_id)) do
      saved
      |> Enum.reject(&(&1.type == :page and not MapSet.member?(public_ids, &1.node_id)))
      |> prune_empty_private(public_ids)
    else
      []
    end
  end

  defp prune_empty_private(nodes, public_ids) do
    empty =
      nodes
      |> Enum.filter(fn node ->
        node.type in [:group, :tab] and not MapSet.member?(public_ids, node.node_id) and
          Enum.all?(nodes, &(&1.parent_node_id != node.node_id))
      end)
      |> MapSet.new(& &1.node_id)

    if MapSet.size(empty) == 0 do
      nodes
    else
      nodes
      |> Enum.reject(&MapSet.member?(empty, &1.node_id))
      |> prune_empty_private(public_ids)
    end
  end

  defp authorize_queue(_community, false, _actor), do: {:ok, :pass}

  defp authorize_queue(community, true, actor) do
    with {:ok, _} <- CMS.Gate.Access.Check.community(actor, :docs_queue_write, community) do
      {:ok, :pass}
    end
  end

  defp restore_lifecycles(_community, docs) do
    Enum.reduce_while(docs, {:ok, :pass}, fn doc, _ ->
      lifecycle =
        Repo.one(
          from(l in ArticleLifecycle,
            where: l.article_id == ^doc.article_id,
            lock: "FOR UPDATE"
          )
        )

      public? = Repo.exists?(from(p in ArticlePublic, where: p.article_id == ^doc.article_id))

      result =
        case {lifecycle, public?} do
          {%ArticleLifecycle{state: :deleted} = item, false} ->
            CMS.Articles.Lifecycle.transition(item, :draft)

          {%ArticleLifecycle{state: :draft} = item, false} ->
            {:ok, item}

          {%ArticleLifecycle{state: state} = item, true} when state in [:published, :archived] ->
            {:ok, item}

          _ ->
            {:error, :invalid_doc_lifecycle}
        end

      case result do
        {:ok, _} -> {:cont, {:ok, :pass}}
        {:error, _} = error -> {:halt, error}
      end
    end)
  end

  defp save_workspace(community, rows, before, target) do
    previous = Map.new(before, &{&1.node_id, &1})
    WorkspacePersist.save(community, rows, Enum.filter(target, &(previous[&1.node_id] != &1)))
  end

  defp reconcile(_community, queue, _public, same, same, _actor, _operation_ref), do: {:ok, queue}

  defp reconcile(community, queue, public, _current, target, actor, operation_ref) do
    with {:ok, result} <-
           Queue.reconcile_tree(
             community,
             queue,
             queue.queue_revision,
             public,
             target,
             actor,
             operation_ref
           ) do
      {:ok, result.queue}
    end
  end

  defp remove_trash(action, entries, docs) do
    {nodes_count, _} =
      Repo.delete_all(from(n in DocsTrashedTreeNode, where: n.trash_action_id == ^action.id))

    {docs_count, _} =
      Repo.delete_all(from(d in DocsTrashedArticle, where: d.trash_action_id == ^action.id))

    if nodes_count == length(entries) and docs_count == length(docs) do
      with {:ok, _} <- Repo.delete(action), do: {:ok, :pass}
    else
      {:error, :trash_action_changed}
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
