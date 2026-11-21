defmodule GroupherServer.CMS.DocTree.WorkspaceUpdate do
  @moduledoc """
  Updates working-tree metadata and reconciles visible Queue nodes atomically.

      UpdateWorkspaceNode command -> WorkspaceUpdate -> working tree and Queue
  """

  import Ecto.Query

  alias GroupherServer.{Accounts, CMS, Repo}
  alias Accounts.Model.User
  alias CMS.DocTree.Publish.{Queue, TargetTree, TreeCodec, TreeOrder}
  alias CMS.DocTree.{Publish.Queue.Dependencies, WorkspacePersist}
  alias CMS.Model.{Article, Community, DocsPublishQueue, DocsQueueTreeChange, DocsTreeNode}

  @fields ~w(node_id type parent_node_id index title href doc_id marker badge hidden)a
  @patch_fields ~w(title href marker badge hidden)a

  @doc "Updates one node, automatically staging its visible Queue change when applicable."
  def run(
        %Community{} = community,
        %DocsPublishQueue{} = queue,
        revision,
        node_id,
        patch,
        %User{} = actor,
        operation_ref
      )
      when is_integer(revision) and revision >= 0 and is_binary(node_id) and is_map(patch) do
    with {:ok, patch} <- normalize_patch(patch),
         {:ok, queue} <- Queue.advance(community, queue, %{tree_lock_version: revision}, []),
         rows <- WorkspacePersist.lock_nodes(community),
         draft <- Enum.map(rows, &Map.take(&1, @fields)),
         {:ok, updated_draft} <- update_node(draft, node_id, patch),
         public <- public_nodes(community),
         changes <- queue_changes(queue),
         {:ok, decoded} <- TreeCodec.decode_changes(changes),
         {:ok, current} <- TargetTree.build(public, decoded),
         {:ok, updated_queue} <- update_queue(current, node_id, patch, draft != updated_draft),
         {:ok, :pass} <-
           authorize_docs(community, [draft, current, updated_queue], [node_id], actor),
         {:ok, :pass} <- authorize_queue_change(community, current, updated_queue, node_id, actor),
         {:ok, result} <-
           persist(
             community,
             queue,
             revision,
             rows,
             draft,
             updated_draft,
             public,
             current,
             updated_queue,
             actor,
             operation_ref
           ) do
      {:ok, result}
    else
      {:error, _reason} = error -> error
    end
  end

  def run(_, _, _, _, _, _, _), do: {:error, :invalid_tree_input}

  @doc "Moves a node and reconciles its actual Queue position and required parent chain."
  def move(
        %Community{} = community,
        %DocsPublishQueue{} = queue,
        revision,
        node_id,
        parent,
        position,
        %User{} = actor,
        operation_ref
      )
      when is_integer(revision) and revision >= 0 and is_binary(node_id) and
             (is_binary(parent) or is_nil(parent)) and is_integer(position) and position >= 0 do
    with {:ok, queue} <- Queue.advance(community, queue, %{tree_lock_version: revision}, []),
         rows <- WorkspacePersist.lock_nodes(community),
         draft <- Enum.map(rows, &Map.take(&1, @fields)),
         {:ok, %{target: target}} <- TreeOrder.move(draft, node_id, parent, position),
         public <- public_nodes(community),
         {:ok, decoded} <- queue_changes(queue) |> TreeCodec.decode_changes(),
         {:ok, current} <- TargetTree.build(public, decoded),
         {:ok, queued_target} <-
           move_queue(public, target, current, node_id, parent, draft != target),
         ids <- changed_ids(draft, target) ++ changed_ids(current, queued_target) ++ [node_id],
         {:ok, :pass} <-
           authorize_docs(community, [draft, target, current, queued_target], ids, actor),
         {:ok, :pass} <- authorize_queue_change(community, current, queued_target, node_id, actor),
         {:ok, result} <-
           persist(
             community,
             queue,
             revision,
             rows,
             draft,
             target,
             public,
             current,
             queued_target,
             actor,
             operation_ref
           ) do
      {:ok, result}
    end
  end

  def move(_, _, _, _, _, _, _, _), do: {:error, :invalid_tree_input}

  @doc "Applies confirmed import navigation without publishing content or overwriting Q bodies."
  def import_nodes(%Community{} = community, imported, %User{} = actor, operation_ref)
      when is_list(imported) and is_binary(operation_ref) do
    with {:ok, queue} <- Queue.lock_or_create(community),
         rows <- WorkspacePersist.lock_nodes(community),
         draft <- Enum.map(rows, &Map.take(&1, @fields)),
         imported <- Enum.map(imported, &Map.take(&1, @fields)),
         ids <- MapSet.new(imported, & &1.node_id),
         true <- length(imported) == MapSet.size(ids),
         merged <- imported ++ Enum.reject(draft, &MapSet.member?(ids, &1.node_id)),
         target <- import_order(merged, ids),
         {:ok, target} <- TargetTree.build(target, []),
         public <- public_nodes(community),
         {:ok, decoded} <- queue_changes(queue) |> TreeCodec.decode_changes(),
         {:ok, current} <- TargetTree.build(public, decoded),
         affected <- changed_ids(draft, target),
         {:ok, :pass} <- authorize_docs(community, [draft, target], affected, actor),
         {:ok, result} <-
           persist(
             community,
             queue,
             queue.tree_lock_version,
             rows,
             draft,
             target,
             public,
             current,
             current,
             actor,
             operation_ref
           ) do
      {:ok, result}
    else
      false -> {:error, :duplicate_import_node}
      {:error, _} = error -> error
    end
  end

  def import_nodes(_, _, _, _), do: {:error, :invalid_tree_input}

  defp import_lane(%{type: :tab}), do: {:tab, nil}
  defp import_lane(%{type: :pin, parent_node_id: parent}), do: {:pin, parent}
  defp import_lane(%{parent_node_id: parent}), do: {:child, parent}

  defp import_order(nodes, imported) do
    nodes
    |> Enum.group_by(&import_lane/1)
    |> Enum.flat_map(fn {_lane, siblings} ->
      siblings
      |> Enum.sort_by(&{not MapSet.member?(imported, &1.node_id), &1.index, &1.node_id})
      |> Enum.with_index(fn node, index -> %{node | index: index} end)
    end)
  end

  defp move_queue(_public, _draft, current, _id, _parent, false), do: {:ok, current}

  defp move_queue(public, draft, current, id, parent, true) do
    if Enum.any?(current, &(&1.node_id == id)) do
      with {:ok, prepared} <- Dependencies.ensure_parent(public, draft, current, parent),
           %{node_id: ^id} = moved <- Enum.find(draft, &(&1.node_id == id)),
           position <- queue_position(draft, prepared, moved),
           {:ok, %{target: target}} <- TreeOrder.move(prepared, id, parent, position) do
        {:ok, target}
      else
        nil -> {:error, :tree_node_not_found}
        {:error, _reason} = error -> error
      end
    else
      {:ok, current}
    end
  end

  defp queue_position(draft, queue, moved) do
    queued_ids = MapSet.new(queue, & &1.node_id)

    Enum.count(draft, fn node ->
      same_lane?(node, moved) and node.index < moved.index and
        MapSet.member?(queued_ids, node.node_id)
    end)
  end

  defp same_lane?(%{type: :tab}, %{type: :tab}), do: true

  defp same_lane?(%{type: :pin, parent_node_id: parent}, %{type: :pin, parent_node_id: parent}) do
    true
  end

  defp same_lane?(%{type: left, parent_node_id: parent}, %{type: right, parent_node_id: parent})
       when left in [:group, :page, :link] and right in [:group, :page, :link] do
    true
  end

  defp same_lane?(_, _), do: false

  defp changed_ids(before, after_nodes) do
    old = Map.new(before, &{&1.node_id, &1})
    after_nodes |> Enum.filter(&(old[&1.node_id] != &1)) |> Enum.map(& &1.node_id)
  end

  defp normalize_patch(patch) do
    with true <- map_size(patch) > 0 and Enum.all?(Map.keys(patch), &(&1 in @patch_fields)),
         {:ok, patch} <- normalize_marker(patch) do
      {:ok, patch}
    else
      _ -> {:error, :invalid_tree_input}
    end
  end

  defp normalize_marker(%{marker: marker} = patch) when is_map(marker) do
    with {:ok, json} <- Jason.encode(marker),
         {:ok, normalized} when is_map(normalized) <- Jason.decode(json) do
      {:ok, Map.put(patch, :marker, normalized)}
    end
  end

  defp normalize_marker(patch), do: {:ok, patch}

  defp update_node(nodes, id, patch) do
    case Enum.find(nodes, &(&1.node_id == id)) do
      nil ->
        {:error, :tree_node_not_found}

      node ->
        target = node |> Map.merge(patch) |> Map.delete(:node_id)
        TargetTree.build(nodes, [%{node_id: id, change_type: :upsert, target: target}])
    end
  end

  defp update_queue(nodes, _id, _patch, false), do: {:ok, nodes}

  defp update_queue(nodes, id, patch, true) do
    if Enum.any?(nodes, &(&1.node_id == id)) do
      update_node(nodes, id, patch)
    else
      {:ok, nodes}
    end
  end

  defp authorize_queue_change(_community, current, target, _node_id, _actor)
       when current == target do
    {:ok, :pass}
  end

  defp authorize_queue_change(community, _before, _after_nodes, _node_id, actor) do
    case CMS.Gate.Access.Check.community(actor, :docs_queue_write, community) do
      {:ok, _} -> {:ok, :pass}
      {:error, _reason} = error -> error
    end
  end

  defp authorize_docs(community, trees, node_ids, actor) do
    ids =
      for tree <- trees,
          node_id <- Enum.uniq(node_ids),
          id <- affected_pages(tree, node_id),
          do: id

    ids = ids |> Enum.uniq() |> Enum.sort()

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

  defp affected_pages(nodes, id) do
    by_id = Map.new(nodes, &{&1.node_id, &1})

    nodes
    |> Enum.filter(&(&1.type == :page and ancestor?(&1, id, by_id)))
    |> Enum.map(& &1.doc_id)
  end

  defp ancestor?(%{node_id: id}, id, _nodes), do: true
  defp ancestor?(%{parent_node_id: nil}, _id, _nodes), do: false

  defp ancestor?(%{parent_node_id: parent}, id, nodes) do
    ancestor?(Map.fetch!(nodes, parent), id, nodes)
  end

  defp persist(
         community,
         queue,
         revision,
         rows,
         draft,
         target,
         public,
         current,
         queued_target,
         actor,
         operation_ref
       ) do
    previous = Map.new(draft, &{&1.node_id, &1})
    changed = Enum.filter(target, &(previous[&1.node_id] != &1))

    with {:ok, :pass} <- WorkspacePersist.save(community, rows, changed),
         {:ok, queue} <-
           Queue.advance(
             community,
             queue,
             %{tree_lock_version: revision},
             [:tree_lock_version],
             operation_ref
           ),
         {:ok, _queue} <-
           reconcile_queue(community, queue, public, current, queued_target, actor, operation_ref) do
      {:ok, %{tree_revision: queue.tree_lock_version}}
    end
  end

  defp reconcile_queue(_community, queue, _public, current, target, _actor, _operation_ref)
       when current == target do
    {:ok, queue}
  end

  defp reconcile_queue(community, queue, public, _current, target, actor, operation_ref) do
    Queue.reconcile_tree(
      community,
      queue,
      queue.queue_revision,
      public,
      target,
      actor,
      operation_ref
    )
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
