defmodule GroupherServer.CMS.DocTree.Trash do
  @moduledoc """
  Product Trash drawer for Docs Tree actions.

  One list item represents one user action, even when a deleted Tab/Group owns
  many Tree nodes and Doc Articles. Restore replays draft/public placement
  snapshots and removes all Article memberships atomically.

  Business position:

      Dashboard / public Docs
        -> CMS.DocTree
        -> Trash
        -> Repo / published projection
  """

  import Ecto.Query, warn: false

  alias GroupherServer.{CMS, ErrorCat, Repo}
  alias GroupherServer.Accounts.Model.User
  alias CMS.Articles.MutationLock
  alias CMS.Docs.Branch
  alias CMS.Docs.Trash, as: DocTrash
  alias CMS.DocTree.Events
  alias CMS.DocTree.Writer.{EventRecorder, Index, Operation}

  alias CMS.Model.{
    Community,
    DocTreeNode,
    TrashAction,
    TrashedDocArticle,
    TrashedDocTreeNode
  }

  alias CMS.SearchArtiments.Indexer
  alias Helper.{ORM, T, Transaction}

  require CMS.Const

  @doc "Lists current Docs Trash actions for one branch under an explicit read policy."
  @spec list(Community.t(), keyword() | map()) :: T.domain_res(list(map()))
  def list(%Community{} = community, opts \\ []) do
    actor = option(opts, :actor)
    policy_mode = option(opts, :policy_mode, :moderator_management)

    with {:ok, _community} <- readable_community(community, actor, policy_mode),
         {:ok, branch} <- Branch.resolve(community, opts) do
      actions =
        TrashAction
        |> join(:inner, [action], node in TrashedDocTreeNode,
          on: node.trash_action_id == action.id
        )
        |> where([action, node], action.community_id == ^community.id)
        |> where([_action, node], node.branch_id == ^branch.id)
        |> where([action, _node], like(action.root_type, "doc_tree_%"))
        |> distinct([action, _node], action.id)
        |> order_by([action, _node], desc: action.deleted_at, desc: action.id)
        |> preload([action, _node], [:actor, :trashed_doc_tree_nodes])
        |> Repo.all()

      {:ok, Enum.map(actions, &to_map/1)}
    end
  end

  defp readable_community(%Community{} = community, actor, _policy_mode) do
    case CMS.Gate.access_check(actor, :manage_docs, community) do
      {:ok, %Community{} = readable} -> {:ok, readable}
      {:error, %CMS.Gate.Decision{} = decision} -> {:error, decision}
      {:error, reason} -> {:error, reason}
    end
  end

  defp option(opts, key, default \\ nil)
  defp option(opts, key, default) when is_map(opts), do: Map.get(opts, key, default)
  defp option(opts, key, default) when is_list(opts), do: Keyword.get(opts, key, default)

  @doc "Restores one complete Docs Trash action."
  @spec restore(Community.t(), T.id(), map()) :: T.domain_res(map())
  def restore(%Community{} = community, action_ref, args) do
    Operation.run(community, args, fn branch, state ->
      with {:ok, actor} <- load_actor(args),
           {:ok, action} <- find_action(community, branch, action_ref),
           items <- action_nodes(action, branch),
           {:ok, items} <- prepare_restore_items(community, branch, action, items, args),
           doc_ids <- action_doc_ids(action, branch),
           {:ok, result} <-
             MutationLock.with_articles(community, :doc, branch.id, doc_ids, fn ->
               restore_action(community, branch, action, items, actor)
             end),
           {:ok, state} <- Operation.bump_revision(community, state, result.tree_event_count) do
        Enum.each(result.articles, &Indexer.enqueue_upsert/1)

        root =
          Enum.find(result.draft_nodes, &(&1.node_id == action.root_ref)) ||
            Enum.find(result.public_nodes, &(&1.node_id == action.root_ref))

        affected =
          result.draft_nodes
          |> Enum.map(&{&1.parent_node_id, &1.type})
          |> Enum.uniq()
          |> Enum.flat_map(fn {parent_id, type} ->
            Index.affected_nodes(community, branch, parent_id, type)
          end)

        {:ok, Operation.payload(community, state, root, affected)}
      else
        error -> error
      end
    end)
  end

  @doc "Permanently deletes one complete Docs Trash action."
  @spec permanently_delete_action(TrashAction.t(), User.t() | nil, keyword()) ::
          T.domain_res(map())
  def permanently_delete_action(%TrashAction{} = action, actor, opts \\ []) do
    with %Community{} = community <- Repo.get(Community, action.community_id),
         %TrashedDocTreeNode{} = root_item <-
           TrashedDocTreeNode
           |> where([item], item.trash_action_id == ^action.id)
           |> order_by([item], asc: item.id)
           |> limit(1)
           |> Repo.one() do
      branch = Repo.get!(CMS.Model.DocBranch, root_item.branch_id)

      Transaction.lock_global("doc_tree:#{community.id}:#{root_item.branch_id}", fn ->
        case TrashAction
             |> where([current], current.id == ^action.id)
             |> lock("FOR UPDATE")
             |> Repo.one() do
          nil ->
            {:ok, %{done: true}}

          current ->
            doc_ids = action_doc_ids(current, branch)

            MutationLock.with_articles(community, :doc, root_item.branch_id, doc_ids, fn ->
              with {:ok, :done} <-
                     DocTrash.permanently_delete_action_articles(
                       current,
                       community,
                       branch,
                       actor,
                       source: Keyword.get(opts, :source, "api"),
                       audit: false,
                       metadata: %{
                         trash_root_type: current.root_type,
                         trash_root_ref: current.root_ref
                       }
                     ),
                   :ok <- delete_tree_memberships(current.id),
                   {:ok, _audit} <-
                     CMS.Audit.record("doc_tree.permanently_deleted", %{
                       community_id: community.id,
                       actor: actor,
                       resource_type: current.root_type,
                       resource_ref: current.root_ref,
                       resource_snapshot: %{doc_count: length(doc_ids)},
                       operation_ref: current.hash_id,
                       source: Keyword.get(opts, :source, "api"),
                       metadata: %{}
                     }),
                   :ok <- CMS.Articles.Trash.delete_empty_action(current.id) do
                {:ok, %{done: true}}
              end
            end)
        end
      end)
    else
      nil -> {:ok, %{done: true}}
      _ -> {:error, GroupherServer.ErrorCat.custom("Trash action is not a Docs Tree action")}
    end
  end

  defp restore_action(community, branch, action, items, actor) do
    with :ok <- shift_root_restore_slots(community, branch, action, items),
         :ok <- ensure_restore_slots_available(community, branch, items),
         {:ok, draft_nodes} <- restore_stage_nodes(community, branch, items, :draft),
         {:ok, public_nodes} <- restore_stage_nodes(community, branch, items, :public),
         {:ok, articles} <-
           DocTrash.restore_action_articles(action, community, branch, actor,
             source: "api",
             audit: false,
             metadata: %{trash_root_type: action.root_type, trash_root_ref: action.root_ref}
           ),
         {:ok, events} <-
           record_restore_events(community, branch, items, draft_nodes, public_nodes, actor),
         :ok <- delete_tree_memberships(action.id),
         {:ok, _audit} <-
           CMS.Audit.record("doc_tree.restored", %{
             community_id: community.id,
             actor: actor,
             resource_type: action.root_type,
             resource_ref: action.root_ref,
             resource_snapshot: %{
               node_count: length(items),
               doc_count: length(articles)
             },
             operation_ref: action.hash_id,
             source: "api",
             metadata: %{}
           }),
         :ok <- CMS.Articles.Trash.delete_empty_action(action.id) do
      {:ok,
       %{
         articles: articles,
         draft_nodes: draft_nodes,
         public_nodes: public_nodes,
         tree_event_count: Enum.count(events, &(&1.owner == CMS.Const.tree_event_owner(:tree)))
       }}
    end
  end

  defp find_action(%Community{} = community, branch, action_ref) do
    TrashAction
    |> from(as: :action)
    |> where([action], action.community_id == ^community.id)
    |> where([action], action.hash_id == ^action_ref)
    |> where([action], like(action.root_type, "doc_tree_%"))
    |> where(
      [action],
      exists(
        from(item in TrashedDocTreeNode,
          where: item.trash_action_id == parent_as(:action).id,
          where: item.branch_id == ^branch.id,
          select: 1
        )
      )
    )
    |> lock("FOR UPDATE")
    |> Repo.one()
    |> case do
      %TrashAction{} = action -> {:ok, action}
      nil -> {:error, CMS.Articles.ErrorCat.not_exist("Docs Trash action")}
    end
  end

  defp action_nodes(%TrashAction{} = action, branch) do
    TrashedDocTreeNode
    |> where([item], item.trash_action_id == ^action.id)
    |> where([item], item.branch_id == ^branch.id)
    |> order_by([item], asc: item.id)
    |> lock("FOR UPDATE")
    |> Repo.all()
  end

  defp action_doc_ids(%TrashAction{} = action, branch) do
    TrashedDocArticle
    |> where([item], item.trash_action_id == ^action.id and item.branch_id == ^branch.id)
    |> select([item], item.article_hash_id)
    |> Repo.all()
  end

  defp load_actor(args) do
    case Map.get(args, :actor_id) do
      nil ->
        {:error,
         GroupherServer.ErrorCat.custom("Docs Trash restore requires an authenticated actor")}

      actor_id ->
        case Repo.get(User, actor_id) do
          %User{} = actor ->
            {:ok, actor}

          nil ->
            {:error,
             GroupherServer.ErrorCat.custom("Docs Trash restore requires an authenticated actor")}
        end
    end
  end

  defp prepare_restore_items(community, branch, action, items, args) do
    root = Enum.find(items, &(&1.node_id == action.root_ref))
    target_parent_node_id = Map.get(args, :target_parent_node_id)
    target_index = Map.get(args, :target_index)

    if root do
      [:draft, :public]
      |> Enum.reduce_while({:ok, root}, fn stage, {:ok, item} ->
        case relocate_root_snapshot(
               community,
               branch,
               items,
               item,
               stage,
               target_parent_node_id,
               target_index
             ) do
          {:ok, next_item} -> {:cont, {:ok, next_item}}
          error -> {:halt, error}
        end
      end)
      |> case do
        {:ok, relocated_root} ->
          {:ok,
           Enum.map(items, fn item ->
             if item.id == relocated_root.id, do: relocated_root, else: item
           end)}

        error ->
          error
      end
    else
      {:error, GroupherServer.ErrorCat.custom("Docs Trash root node is missing")}
    end
  end

  defp relocate_root_snapshot(
         community,
         branch,
         items,
         item,
         stage,
         target_parent_node_id,
         target_index
       ) do
    data = snapshot(item, stage)

    if is_nil(data) do
      {:ok, item}
    else
      original_parent_node_id = data["parentNodeId"]

      cond do
        item.type == :tab ->
          {:ok, item}

        not is_nil(target_parent_node_id) ->
          with :ok <-
                 validate_restore_parent(
                   community,
                   branch,
                   stage,
                   item.type,
                   target_parent_node_id
                 ) do
            {:ok,
             put_snapshot(
               item,
               stage,
               data
               |> Map.put("parentNodeId", to_string(target_parent_node_id))
               |> maybe_put_restore_index(target_index)
             )}
          end

        restore_parent_available?(
          community,
          branch,
          items,
          stage,
          original_parent_node_id
        ) ->
          {:ok, item}

        true ->
          {:error,
           ErrorCat.custom(
             "The original Docs Tree parent no longer exists; select a new parent before restoring."
           )}
      end
    end
  end

  defp restore_parent_available?(_community, _branch, _items, _stage, nil), do: false

  defp restore_parent_available?(community, branch, items, stage, parent_node_id) do
    Enum.any?(items, fn item ->
      item.node_id == parent_node_id and not is_nil(snapshot(item, stage))
    end) ||
      DocTreeNode
      |> where([node], node.community_id == ^community.id)
      |> where([node], node.branch_id == ^branch.id)
      |> where([node], node.stage == ^stage and node.node_id == ^parent_node_id)
      |> Repo.exists?()
  end

  defp validate_restore_parent(community, branch, stage, type, parent_node_id) do
    parent =
      DocTreeNode
      |> where([node], node.community_id == ^community.id)
      |> where([node], node.branch_id == ^branch.id)
      |> where([node], node.stage == ^stage and node.node_id == ^to_string(parent_node_id))
      |> Repo.one()

    case {type, parent} do
      {:pin, %DocTreeNode{type: :tab}} ->
        :ok

      {:group, %DocTreeNode{type: parent_type}} when parent_type in [:tab, :group] ->
        :ok

      {child_type, %DocTreeNode{type: :group}} when child_type in [:page, :link] ->
        :ok

      {_type, nil} ->
        {:error,
         GroupherServer.ErrorCat.custom(
           "The selected restore parent does not exist in every restored stage."
         )}

      _ ->
        {:error,
         GroupherServer.ErrorCat.custom("The selected node can not parent this Docs Tree item.")}
    end
  end

  defp maybe_put_restore_index(data, index) when is_integer(index) and index >= 0,
    do: Map.put(data, "index", index)

  defp maybe_put_restore_index(data, _index), do: data

  defp put_snapshot(item, :draft, data), do: %{item | draft_snapshot: data}
  defp put_snapshot(item, :public, data), do: %{item | public_snapshot: data}

  defp shift_root_restore_slots(community, branch, action, items) do
    root = Enum.find(items, &(&1.node_id == action.root_ref))

    Enum.each([:draft, :public], fn stage ->
      if root && snapshot(root, stage) do
        data = snapshot(root, stage)

        shift_restore_slot(
          community,
          branch,
          stage,
          data["parentNodeId"],
          root.type,
          data["index"] || 0
        )
      end
    end)

    :ok
  end

  defp shift_restore_slot(community, branch, stage, parent_node_id, type, from_index) do
    scope =
      DocTreeNode
      |> where([node], node.community_id == ^community.id)
      |> where([node], node.branch_id == ^branch.id and node.stage == ^stage)
      |> where([node], node.index >= ^from_index)
      |> where_restore_scope(parent_node_id, type)

    Repo.update_all(scope, inc: [index: 100_000])

    scope
    |> where([node], node.index >= ^(from_index + 100_000))
    |> Repo.update_all(inc: [index: -99_999])

    :ok
  end

  defp where_restore_scope(query, nil, :tab),
    do: query |> where([node], is_nil(node.parent_node_id)) |> where([node], node.type == :tab)

  defp where_restore_scope(query, parent_node_id, :pin),
    do:
      query
      |> where([node], node.parent_node_id == ^parent_node_id)
      |> where([node], node.type == :pin)

  defp where_restore_scope(query, parent_node_id, _type),
    do:
      query
      |> where([node], node.parent_node_id == ^parent_node_id)
      |> where([node], node.type in [:group, :page, :link])

  defp ensure_restore_slots_available(community, branch, items) do
    conflicts? =
      Enum.any?([:draft, :public], fn stage ->
        node_ids =
          items
          |> Enum.filter(&(not is_nil(snapshot(&1, stage))))
          |> Enum.map(& &1.node_id)

        node_ids != [] and
          DocTreeNode
          |> where([node], node.community_id == ^community.id)
          |> where([node], node.branch_id == ^branch.id)
          |> where([node], node.stage == ^stage)
          |> where([node], node.node_id in ^node_ids)
          |> Repo.exists?()
      end)

    if conflicts?,
      do:
        {:error,
         GroupherServer.ErrorCat.custom("A Docs Tree node with the same identity already exists")},
      else: :ok
  end

  defp restore_stage_nodes(community, branch, items, stage) do
    items
    |> Enum.filter(&(not is_nil(snapshot(&1, stage))))
    |> Enum.sort_by(fn item ->
      data = snapshot(item, stage)
      {type_rank(item.type), data["index"] || 0, item.node_id}
    end)
    |> Enum.reduce_while({:ok, []}, fn item, {:ok, nodes} ->
      attrs = snapshot_attrs(community, branch, item, stage)

      case ORM.create(DocTreeNode, attrs) do
        {:ok, node} -> {:cont, {:ok, [node | nodes]}}
        error -> {:halt, error}
      end
    end)
    |> case do
      {:ok, nodes} -> {:ok, Enum.reverse(nodes)}
      error -> error
    end
  end

  defp record_restore_events(community, branch, items, draft_nodes, public_nodes, actor) do
    drafts = Map.new(draft_nodes, &{&1.node_id, &1})
    publics = Map.new(public_nodes, &{&1.node_id, &1})

    events =
      Enum.flat_map(items, fn item ->
        draft = Map.get(drafts, item.node_id)
        public = Map.get(publics, item.node_id)
        restore_events(draft, public)
      end)

    Events.record_staged_many(community, events, actor.id, branch_id: branch.id)
  end

  defp restore_events(nil, _public), do: []

  defp restore_events(%DocTreeNode{} = draft, nil) do
    event = Events.create_event(draft)

    if draft.type == :page do
      [EventRecorder.doc_owned_create_event(draft)]
    else
      [event]
    end
  end

  defp restore_events(%DocTreeNode{} = draft, %DocTreeNode{} = public) do
    field_events = Events.update_events(public, draft)

    placement_events =
      if parent_id(public) != parent_id(draft) or public.index != draft.index do
        [Events.move_event(draft, parent_id(public), public.index, parent_id(draft), draft.index)]
      else
        []
      end

    field_events ++ placement_events
  end

  defp delete_tree_memberships(action_id) do
    TrashedDocTreeNode
    |> where([item], item.trash_action_id == ^action_id)
    |> Repo.delete_all()

    :ok
  end

  defp snapshot(item, :draft), do: item.draft_snapshot
  defp snapshot(item, :public), do: item.public_snapshot

  defp snapshot_attrs(community, branch, item, stage) do
    data = snapshot(item, stage)

    %{
      community_id: community.id,
      branch_id: branch.id,
      node_id: data["nodeId"] || item.node_id,
      stage: stage,
      type: item.type,
      parent_node_id: data["parentNodeId"],
      doc_id: data["docId"] || item.doc_id,
      title: data["title"],
      index: data["index"] || 0,
      href: data["href"],
      marker: data["marker"],
      badge: data["badge"],
      hidden: Map.get(data, "hidden", false)
    }
  end

  defp to_map(%TrashAction{} = action) do
    root =
      Enum.find(action.trashed_doc_tree_nodes, &(&1.node_id == action.root_ref)) ||
        List.first(action.trashed_doc_tree_nodes)

    data = root.draft_snapshot || root.public_snapshot || %{}

    %{
      id: action.hash_id,
      node_id: root.node_id,
      doc_id: root.doc_id,
      type: to_string(root.type),
      title: data["title"] || root.node_id,
      deleted_from_parent_node_id: data["parentNodeId"],
      deleted_from_index: data["index"],
      deleted_at: action.deleted_at,
      restored_at: nil
    }
  end

  defp parent_id(%DocTreeNode{} = node), do: node.parent_node_id

  defp type_rank(:tab), do: 0
  defp type_rank(:group), do: 1
  defp type_rank(_type), do: 2
end
