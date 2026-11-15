defmodule GroupherServer.CMS.DocTree.WorkspaceDelete do
  @moduledoc """
  Plans and applies one recoverable workspace subtree deletion.

    The caller holds the site lock and owns Gate, Receipt and transaction rollback.
    The public tree stays unchanged until its queued deletion is released.

      DeleteWorkspaceNode command -> WorkspaceDelete -> Trash and queued tree changes
  """

  import Ecto.Query
  alias GroupherServer.{Accounts, CMS, Repo}
  alias Accounts.Model.User
  alias CMS.DocTree.Publish.{Queue, TargetTree, TreeCodec, TreeOrder}
  alias CMS.DocTree.Publish.Queue.{Dequeue, Tree}
  alias CMS.DocTree.WorkspacePersist

  alias CMS.Model.{
    Article,
    ArticleBinding,
    ArticleLifecycle,
    ArticlePublic,
    Community,
    DocsPublishQueue,
    DocsQueueArticle
  }

  alias CMS.Model.{DocsQueueTreeChange, DocsTreeNode, DocsTrashedArticle, DocsTrashedTreeNode}

  @fields ~w(node_id type parent_node_id index title href doc_id marker badge hidden)a

  @doc "Calculates the complete removal and its Q-only edit confirmation under the site lock."
  def preview(
        %Community{} = community,
        %DocsPublishQueue{} = queue,
        tree_revision,
        queue_revision,
        node_id,
        %User{} = actor
      ) do
    with {:ok, plan} <- plan(community, queue, tree_revision, queue_revision, node_id, actor),
         {:ok, confirmation} <- confirmation(plan, queue_revision) do
      {:ok,
       Map.merge(confirmation, %{public_count: plan.public_count, draft_count: plan.draft_count})}
    end
  end

  @doc "Moves the workspace subtree into Trash and queues its public deletion atomically."
  def run(
        %Community{} = community,
        %DocsPublishQueue{} = queue,
        tree_revision,
        queue_revision,
        node_id,
        proof,
        %User{} = actor
      ) do
    with {:ok, plan} <- plan(community, queue, tree_revision, queue_revision, node_id, actor),
         {:ok, removed_queue, advanced?} <-
           remove_copies(community, queue, queue_revision, plan, proof),
         {:ok, action} <- trash(community, plan, actor),
         {:ok, :pass} <- delete_workspace(community, plan),
         {:ok, queue} <-
           Queue.advance(community, removed_queue, %{tree_lock_version: tree_revision}, [
             :tree_lock_version
           ]),
         {:ok, queue} <- reconcile(community, queue, plan, advanced?, actor) do
      {:ok,
       %{
         trash_action_id: action.hash_id,
         tree_revision: queue.tree_lock_version,
         queue_revision: queue.queue_revision
       }}
    end
  end

  defp plan(community, queue, tree_revision, queue_revision, node_id, actor)
       when is_integer(tree_revision) and tree_revision >= 0 and is_integer(queue_revision) and
              queue_revision >= 0 and is_binary(node_id) do
    with {:ok, queue} <-
           Queue.advance(
             community,
             queue,
             %{tree_lock_version: tree_revision, queue_revision: queue_revision},
             []
           ),
         rows <- WorkspacePersist.lock_nodes(community),
         draft <- Enum.map(rows, &Map.take(&1, @fields)),
         {:ok, draft_ids} <- subtree(draft, node_id),
         public <- nodes(community, :public),
         {:ok, decoded} <- changes(queue) |> TreeCodec.decode_changes(),
         {:ok, queued} <- TargetTree.build(public, decoded),
         {:ok, queued_ids} <- queued_removal(queued, draft, draft_ids, node_id),
         {:ok, %{target: draft_target}} <- TreeOrder.remove(draft, draft_ids),
         {:ok, %{target: queue_target}} <- TreeOrder.remove(queued, queued_ids),
         doc_ids <- page_ids(draft, draft_ids),
         removed_ids <- Enum.sort(Enum.uniq(doc_ids ++ page_ids(queued, queued_ids))),
         {:ok, :pass} <- authorize(community, removed_ids, :delete, actor),
         survivor_ids <- changed_pages(draft, draft_target) ++ changed_pages(queued, queue_target),
         survivor_ids <- survivor_ids |> Enum.uniq() |> Kernel.--(removed_ids) |> Enum.sort(),
         {:ok, :pass} <- authorize(community, survivor_ids, :edit, actor),
         member_ids <- member_ids(queue, removed_ids),
         {:ok, :pass} <-
           authorize_queue(community, queued != queue_target or member_ids != [], actor),
         {:ok, locked} <- lock_members(community, queue, member_ids),
         public_ids <- MapSet.new(page_ids(public, Enum.map(public, & &1.node_id))),
         operation <- %{
           "kind" => "delete_workspace_node",
           "community_id" => community.id,
           "node_id" => node_id,
           "tree_revision" => tree_revision,
           "article_ids" => member_ids
         } do
      {:ok,
       %{
         community: community,
         rows: rows,
         draft: draft,
         draft_ids: draft_ids,
         draft_target: draft_target,
         public: public,
         queued: queued,
         queued_ids: queued_ids,
         queue_target: queue_target,
         member_ids: member_ids,
         documents: locked,
         operation: operation,
         doc_ids: doc_ids,
         root_id: node_id,
         public_count: Enum.count(doc_ids, &MapSet.member?(public_ids, &1)),
         draft_count: Enum.count(doc_ids, &(not MapSet.member?(public_ids, &1)))
       }}
    end
  end

  defp plan(_, _, _, _, _, _), do: {:error, :invalid_tree_input}

  defp subtree(nodes, id) do
    if Enum.any?(nodes, &(&1.node_id == id)) do
      {:ok, descendants(nodes, MapSet.new([id])) |> MapSet.to_list() |> Enum.sort()}
    else
      {:error, :tree_node_not_found}
    end
  end

  defp descendants(nodes, ids) do
    next =
      Enum.reduce(nodes, ids, fn node, acc ->
        if MapSet.member?(ids, node.parent_node_id), do: MapSet.put(acc, node.node_id), else: acc
      end)

    if MapSet.equal?(ids, next), do: ids, else: descendants(nodes, next)
  end

  defp queued_removal(queued, draft, draft_ids, root_id) do
    selected_docs = MapSet.new(page_ids(draft, draft_ids))

    roots =
      queued
      |> Enum.filter(
        &(&1.node_id == root_id or (&1.type == :page and MapSet.member?(selected_docs, &1.doc_id)))
      )
      |> MapSet.new(& &1.node_id)

    removed = descendants(queued, roots)
    draft_set = MapSet.new(draft_ids)
    draft_node_ids = MapSet.new(draft, & &1.node_id)

    if Enum.any?(
         removed,
         &(MapSet.member?(draft_node_ids, &1) and not MapSet.member?(draft_set, &1))
       ) do
      {:error, :docs_delete_diverged_tree}
    else
      {:ok, removed |> MapSet.to_list() |> Enum.sort()}
    end
  end

  defp page_ids(nodes, ids) do
    selected = MapSet.new(ids)

    nodes
    |> Enum.filter(&(&1.type == :page and MapSet.member?(selected, &1.node_id)))
    |> Enum.map(& &1.doc_id)
    |> Enum.uniq()
    |> Enum.sort()
  end

  defp changed_pages(before, after_nodes) do
    prior = Map.new(before, &{&1.node_id, &1})
    changed = after_nodes |> Enum.filter(&(prior[&1.node_id] != &1)) |> MapSet.new(& &1.node_id)
    page_ids(after_nodes, descendants(after_nodes, changed) |> MapSet.to_list())
  end

  defp authorize(community, ids, action, actor) do
    articles =
      Repo.all(from(a in Article, where: a.id in ^ids, order_by: a.id, lock: "FOR UPDATE"))

    if length(articles) != length(ids) do
      {:error, :invalid_doc_identity}
    else
      Enum.reduce_while(articles, {:ok, :pass}, fn article, _ ->
        case CMS.Gate.Access.Check.with_authorized_article_binding(
               actor,
               action,
               {community, article},
               fn _ -> {:ok, :pass} end
             ) do
          {:ok, :pass} -> {:cont, {:ok, :pass}}
          {:error, _} = error -> {:halt, error}
        end
      end)
    end
  end

  defp authorize_queue(_community, false, _actor), do: {:ok, :pass}

  defp authorize_queue(community, true, actor) do
    with {:ok, _} <- CMS.Gate.Access.Check.community(actor, :docs_queue_preview, community),
         {:ok, _} <- CMS.Gate.Access.Check.community(actor, :docs_queue_write, community) do
      {:ok, :pass}
    end
  end

  defp member_ids(queue, ids) do
    Repo.all(
      from(m in DocsQueueArticle,
        where: m.queue_id == ^queue.id and m.article_id in ^ids,
        order_by: m.article_id,
        select: m.article_id
      )
    )
  end

  defp lock_members(_community, _queue, []), do: {:ok, []}

  defp lock_members(community, queue, ids) do
    with {:ok, result} <- Dequeue.load_locked(community, queue, ids), do: {:ok, result.documents}
  end

  defp confirmation(%{documents: []}, _revision) do
    {:ok, %{requires_confirmation: false, confirmation: nil, documents: []}}
  end

  defp confirmation(plan, revision) do
    case Queue.check_discard(plan.operation, revision, plan.documents) do
      {:ok, _} ->
        {:ok, %{requires_confirmation: false, confirmation: nil, documents: []}}

      {:error, {:discard_confirmation_required, detail}} ->
        {:ok,
         %{
           requires_confirmation: true,
           confirmation: detail.confirmation,
           documents: detail.documents
         }}

      {:error, _} = error ->
        error
    end
  end

  defp remove_copies(_community, queue, _revision, %{member_ids: []}, nil) do
    {:ok, queue, false}
  end

  defp remove_copies(_community, _queue, _revision, %{member_ids: []}, _proof) do
    {:error, :stale_discard_confirmation}
  end

  defp remove_copies(community, queue, revision, plan, proof) do
    with {:ok, result} <-
           Queue.remove_many(community, queue, revision, plan.member_ids, plan.operation, proof) do
      {:ok, result.queue, true}
    end
  end

  defp trash(community, plan, actor) do
    now = DateTime.utc_now(:second)
    public = Map.new(plan.public, &{&1.node_id, &1})

    lifecycles =
      Repo.all(
        from(l in ArticleLifecycle,
          join: b in ArticleBinding,
          on: b.article_id == l.article_id and b.community_id == ^community.id,
          where: l.thread == :doc and l.article_id in ^plan.doc_ids,
          order_by: l.article_id,
          lock: "FOR UPDATE"
        )
      )

    public_heads =
      Repo.all(
        from(p in ArticlePublic, where: p.article_id in ^plan.doc_ids, select: p.article_id)
      )
      |> MapSet.new()

    public_pages = plan.public |> Enum.filter(&(&1.type == :page)) |> MapSet.new(& &1.doc_id)

    consistent? =
      Enum.all?(lifecycles, fn lifecycle ->
        case lifecycle.state do
          :draft ->
            not MapSet.member?(public_heads, lifecycle.article_id) and
              not MapSet.member?(public_pages, lifecycle.article_id)

          :published ->
            MapSet.member?(public_heads, lifecycle.article_id) and
              MapSet.member?(public_pages, lifecycle.article_id)

          _ ->
            false
        end
      end)

    if length(lifecycles) != length(plan.doc_ids) or not consistent? do
      {:error, :invalid_doc_lifecycle}
    else
      with {:ok, action} <-
             CMS.Articles.Trash.create_action(community, actor, %{
               root_type: :doc_tree_node,
               root_ref: plan.root_id
             }),
           {:ok, :pass} <- insert_docs(community, action, lifecycles, actor, now),
           {:ok, :pass} <- insert_nodes(community, action, plan, public, actor, now) do
        {:ok, action}
      end
    end
  end

  defp insert_docs(community, action, lifecycles, actor, now) do
    Enum.reduce_while(lifecycles, {:ok, :pass}, fn lifecycle, _ ->
      attrs = %{
        trash_action_id: action.id,
        community_id: community.id,
        article_id: lifecycle.article_id,
        restore_state: lifecycle.state,
        deleted_by_id: actor.id,
        deleted_at: now
      }

      case Repo.insert(DocsTrashedArticle.changeset(%DocsTrashedArticle{}, attrs)) do
        {:ok, _} -> {:cont, {:ok, :pass}}
        {:error, _} = error -> {:halt, error}
      end
    end)
  end

  defp insert_nodes(community, action, plan, public, actor, now) do
    draft = Map.new(plan.draft, &{&1.node_id, &1})
    queued = Map.new(plan.queued, &{&1.node_id, &1})

    (plan.draft_ids ++ plan.queued_ids)
    |> Enum.uniq()
    |> Enum.sort()
    |> Enum.reduce_while({:ok, :pass}, fn id, _ ->
      node = draft[id] || queued[id]

      attrs = %{
        trash_action_id: action.id,
        community_id: community.id,
        node_id: node.node_id,
        doc_id: node.doc_id,
        type: node.type,
        draft_snapshot: if(id in plan.draft_ids, do: json(draft[id])),
        public_snapshot: json(public[node.node_id]),
        queue_snapshot: if(id in plan.queued_ids, do: json(queued[id])),
        deleted_by_id: actor.id,
        deleted_at: now
      }

      case Repo.insert(DocsTrashedTreeNode.changeset(%DocsTrashedTreeNode{}, attrs)) do
        {:ok, _} -> {:cont, {:ok, :pass}}
        {:error, _} = error -> {:halt, error}
      end
    end)
  end

  defp json(nil), do: nil
  defp json(value), do: value |> Jason.encode!() |> Jason.decode!()

  defp delete_workspace(community, plan) do
    {count, _} =
      Repo.delete_all(
        from(n in DocsTreeNode,
          where:
            n.community_id == ^community.id and n.stage == :draft and n.node_id in ^plan.draft_ids
        )
      )

    if count == length(plan.draft_ids) do
      old = Map.new(plan.draft, &{&1.node_id, &1})
      changed = Enum.filter(plan.draft_target, &(old[&1.node_id] != &1))
      WorkspacePersist.save(community, plan.rows, changed)
    else
      {:error, :docs_tree_changed}
    end
  end

  defp reconcile(_community, queue, %{queued: same, queue_target: same}, false, _actor) do
    {:ok, queue}
  end

  defp reconcile(community, queue, plan, true, actor) do
    with {:ok, result} <-
           Tree.reconcile_after_content(
             community,
             queue,
             queue.queue_revision,
             plan.public,
             plan.queue_target,
             actor
           ) do
      {:ok, result.queue}
    end
  end

  defp reconcile(community, queue, plan, false, actor) do
    with {:ok, result} <-
           Queue.reconcile_tree(
             community,
             queue,
             queue.queue_revision,
             plan.public,
             plan.queue_target,
             actor
           ) do
      {:ok, result.queue}
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
