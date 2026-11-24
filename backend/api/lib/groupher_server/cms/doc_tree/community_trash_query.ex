defmodule GroupherServer.CMS.DocTree.CommunityTrashQuery do
  @moduledoc """
  Reads Docs subtree Trash as one Community Article Trash item per TrashAction.

  This is a snapshot reader. It deliberately does not acquire the Docs site
  advisory lock, so browsing Trash cannot serialize with Queue or Release writes.

      GraphQL Community Trash -> Gate admission -> repeatable-read snapshot
        -> TrashAction subtree projection -> page / detail / member results
  """

  import Ecto.Query

  alias GroupherServer.{CMS, Repo}

  alias CMS.Model.{
    Article,
    Community,
    DocsPublishQueue,
    DocsQueueTreeChange,
    DocsTrashedArticle,
    DocsTrashedTreeNode,
    DocsTreeNode,
    TrashAction
  }

  alias CMS.{ErrorCat, Gate}
  alias CMS.Articles.ErrorCat, as: ArticlesErrorCat

  alias Helper.ORM

  @surface "community.article.trash.doc"
  @members_surface "community.article.trash.doc.members"

  def page(%Community{} = community, actor, pagi) do
    read_snapshot(fn ->
      with {:ok, :pass} <- authorize(community, actor),
           {:ok, page} <-
             ORM.pagi(actions(community), pagi,
               for: TrashAction,
               surface: @surface,
               query_fingerprint: "community:#{community.id}:doc",
               cursor_value_func: fn row, fields -> Map.take(row, fields) end,
               order: %Helper.ORM.Pagi.Order{
                 fields: [:deleted_at, :id],
                 directions: [:desc, :desc],
                 cursor_fields: [:deleted_at, :id]
               }
             ),
           {:ok, entries} <- project_many(community, page.entries) do
        {:ok, %{page | entries: entries}}
      end
    end)
  end

  def page(_, _, _), do: {:error, ArticlesErrorCat.unsupported_community_trash_thread()}

  def get(%Community{} = community, actor, hash_id) when is_binary(hash_id) do
    read_snapshot(fn ->
      with {:ok, :pass} <- authorize(community, actor),
           {:ok, uuid} <- Ecto.UUID.cast(hash_id),
           %TrashAction{} = action <-
             Repo.one(from(a in actions(community), where: a.hash_id == ^uuid, limit: 1)),
           {:ok, [item]} <- project_many(community, [action]) do
        {:ok, item}
      else
        nil -> {:error, Gate.ErrorCat.resource_not_found()}
        :error -> {:error, Gate.ErrorCat.resource_not_found()}
        {:error, _} -> {:error, Gate.ErrorCat.resource_not_found()}
      end
    end)
  end

  def get(_, _, _), do: {:error, Gate.ErrorCat.resource_not_found()}

  @doc "Validates the opaque Trash snapshot token while the caller holds the Queue lock."
  def validate_revision(%Community{} = community, hash_id, revision, queue)
      when is_binary(hash_id) and is_binary(revision) do
    with {:ok, uuid} <- Ecto.UUID.cast(hash_id),
         %TrashAction{} = action <-
           Repo.one(from(a in actions(community), where: a.hash_id == ^uuid, limit: 1)),
         expected <-
           revision_token(
             community,
             action,
             queue.tree_lock_version,
             queue.queue_revision
           ),
         true <- Plug.Crypto.secure_compare(expected, revision) do
      {:ok, :pass}
    else
      _ -> {:error, ErrorCat.docs_state_conflict()}
    end
  end

  def validate_revision(_, _, _, _), do: {:error, ErrorCat.docs_state_conflict()}

  @doc "Pages a Trash subtree's members after rechecking its stateless snapshot token."
  def members(%Community{} = community, actor, hash_id, revision, pagi)
      when is_binary(hash_id) and is_binary(revision) do
    read_snapshot(fn ->
      with {:ok, :pass} <- authorize(community, actor),
           {:ok, uuid} <- Ecto.UUID.cast(hash_id),
           %TrashAction{} = action <-
             Repo.one(from(a in actions(community), where: a.hash_id == ^uuid, limit: 1)),
           queue <- Repo.get_by(DocsPublishQueue, community_id: community.id),
           {:ok, :pass} <-
             validate_revision(community, action.hash_id, revision, queue || empty_queue()),
           {:ok, page} <- members_page(community, action, pagi, queue) do
        {:ok, page}
      else
        nil -> {:error, Gate.ErrorCat.resource_not_found()}
        :error -> {:error, Gate.ErrorCat.resource_not_found()}
        {:error, _} = error -> error
      end
    end)
  end

  def members(_, _, _, _, _), do: {:error, Gate.ErrorCat.resource_not_found()}

  defp members_page(community, action, pagi, queue) do
    query =
      from(member in DocsTrashedArticle,
        join: node in DocsTrashedTreeNode,
        on:
          node.trash_action_id == member.trash_action_id and
            node.community_id == member.community_id and node.doc_id == member.article_id,
        where: member.trash_action_id == ^action.id and member.community_id == ^community.id,
        select: {member, node}
      )

    with {:ok, page} <-
           ORM.pagi(query, pagi,
             for: DocsTrashedArticle,
             surface: @members_surface,
             query_fingerprint: "community:#{community.id}:doc:#{action.hash_id}",
             cursor_value_func: fn {member, _node}, fields -> Map.take(member, fields) end,
             order: %Helper.ORM.Pagi.Order{
               fields: [:inserted_at, :id],
               directions: [:asc, :asc],
               cursor_fields: [:inserted_at, :id]
             }
           ) do
      member_ids = Enum.map(page.entries, fn {member, _node} -> member.article_id end)

      public_tree_ids = public_tree_ids(community, member_ids)

      pending_nodes =
        if queue do
          Repo.all(
            from(change in DocsQueueTreeChange,
              where:
                change.queue_id == ^queue.id and change.community_id == ^community.id and
                  change.change_type == :delete,
              select: change.node_id
            )
          )
          |> MapSet.new()
        else
          MapSet.new()
        end

      entries =
        Enum.map(page.entries, fn {member, node} ->
          snapshot = node.draft_snapshot || node.public_snapshot || node.queue_snapshot || %{}
          pending? = MapSet.member?(pending_nodes, node.node_id)

          %{
            id: member.hash_id,
            article_id: member.article_id,
            title: snapshot["title"],
            deletion_status: if(pending?, do: :pending, else: :effective),
            removed_from_public:
              not pending? and MapSet.member?(public_tree_ids, member.article_id) == false and
                not is_nil(node.public_snapshot)
          }
        end)

      {:ok, %{page | entries: entries}}
    end
  end

  defp read_snapshot(callback) when is_function(callback, 0) do
    if Repo.in_transaction?() or Repo.checked_out?() do
      isolation = Repo.query!("SHOW transaction_isolation").rows

      case isolation do
        [["repeatable read"]] -> callback.()
        _ -> {:error, :docs_snapshot_requires_repeatable_read}
      end
    else
      Repo.transact(fn ->
        Repo.query!("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY")
        callback.()
      end)
    end
  end

  defp empty_queue do
    %DocsPublishQueue{tree_lock_version: 0, queue_revision: 0}
  end

  defp public_doc_ids(_community, []), do: MapSet.new()

  defp public_doc_ids(community, article_ids) do
    context =
      CMS.Gate.Context.Scope.Doc.public(passport_granted_community_slugs: [community.slug])

    community_public_pages =
      from(node in DocsTreeNode,
        where:
          node.community_id == ^community.id and node.stage == :public and node.type == :page,
        select: node.doc_id
      )

    case CMS.Gate.scope(Article, nil, :list, context) do
      %Ecto.Query{} = query ->
        Repo.all(
          from(article in query,
            where: article.id in ^article_ids,
            where: article.id in subquery(community_public_pages),
            select: article.id
          )
        )
        |> MapSet.new()

      _ ->
        MapSet.new()
    end
  end

  defp public_tree_ids(_community, []), do: MapSet.new()

  defp public_tree_ids(community, article_ids) do
    Repo.all(
      from(node in DocsTreeNode,
        where:
          node.community_id == ^community.id and node.stage == :public and node.type == :page and
            node.doc_id in ^article_ids,
        select: node.doc_id
      )
    )
    |> MapSet.new()
  end

  defp actions(community) do
    from(a in TrashAction,
      where: a.community_id == ^community.id and a.root_type == "doc_tree_node"
    )
  end

  defp authorize(community, actor) do
    with {:ok, _community} <-
           Gate.community_snapshot_check(actor, :community_article_trash_read, community) do
      {:ok, :pass}
    else
      _ -> {:error, Gate.ErrorCat.permission_denied()}
    end
  end

  defp project_many(_community, []), do: {:ok, []}

  defp project_many(community, actions) do
    action_ids = Enum.map(actions, & &1.id)
    root_ids = Map.new(actions, &{&1.id, &1.root_ref})

    nodes =
      Repo.all(
        from(n in DocsTrashedTreeNode,
          where: n.trash_action_id in ^action_ids and n.community_id == ^community.id,
          order_by: [asc: n.trash_action_id, asc: n.node_id]
        )
      )

    docs =
      Repo.all(
        from(d in DocsTrashedArticle,
          where: d.trash_action_id in ^action_ids and d.community_id == ^community.id,
          select: {d.trash_action_id, d.article_id}
        )
      )

    page_docs =
      nodes
      |> Enum.filter(&(&1.type == :page and not is_nil(&1.doc_id)))
      |> Enum.map(& &1.doc_id)
      |> Enum.uniq()

    public_ids = public_doc_ids(community, page_docs)
    public_tree_ids = public_tree_ids(community, page_docs)

    queue = Repo.get_by(DocsPublishQueue, community_id: community.id)

    queue_changes =
      if queue do
        Repo.all(
          from(change in DocsQueueTreeChange,
            where:
              change.queue_id == ^queue.id and change.community_id == ^community.id and
                change.change_type == :delete,
            select: change.node_id
          )
        )
        |> MapSet.new()
      else
        MapSet.new()
      end

    nodes_by_action = Enum.group_by(nodes, & &1.trash_action_id)
    docs_by_action = Enum.group_by(docs, &elem(&1, 0), &elem(&1, 1))
    tree_revision = if queue, do: queue.tree_lock_version, else: 0
    queue_revision = if queue, do: queue.queue_revision, else: 0

    Enum.reduce_while(actions, {:ok, []}, fn action, {:ok, acc} ->
      action_nodes = nodes_by_action[action.id] || []

      case Enum.find(action_nodes, &(&1.node_id == root_ids[action.id])) do
        nil ->
          {:halt, {:error, :invalid_trash_action}}

        root ->
          action_docs = Map.get(docs_by_action, action.id, []) |> MapSet.new()
          page_nodes = Enum.filter(action_nodes, &(&1.type == :page and &1.doc_id in action_docs))
          pending_nodes = Enum.filter(page_nodes, &MapSet.member?(queue_changes, &1.node_id))
          pending_docs = Enum.map(pending_nodes, & &1.doc_id) |> Enum.uniq()

          removed_docs =
            page_nodes
            |> Enum.filter(&(not is_nil(&1.public_snapshot)))
            |> Enum.reject(&MapSet.member?(public_tree_ids, &1.doc_id))
            |> Enum.map(& &1.doc_id)
            |> Enum.uniq()

          pending_count = length(pending_docs)
          removed_count = length(removed_docs)
          status = if pending_count > 0 and removed_count == 0, do: :pending, else: :effective
          snapshot = root.draft_snapshot || root.public_snapshot || root.queue_snapshot || %{}
          tree_path = tree_path(action_nodes, root)

          item = %{
            __typename: "CommunityDocTreeTrashItem",
            id: action.hash_id,
            community_id: community.id,
            community: community,
            thread: :doc,
            status: status,
            public_visible: Enum.any?(page_nodes, &MapSet.member?(public_ids, &1.doc_id)),
            record_revision: revision_token(community, action, tree_revision, queue_revision),
            created_at: action.deleted_at,
            tree_path: tree_path,
            pending_member_count: pending_count,
            removed_member_count: removed_count,
            title: snapshot["title"],
            deleted_from_parent_node_id: snapshot["parent_node_id"],
            deleted_from_index: snapshot["index"],
            node_id: root.node_id,
            doc_id: root.doc_id,
            type: Atom.to_string(root.type),
            tree_revision: tree_revision,
            queue_revision: queue_revision
          }

          {:cont, {:ok, [item | acc]}}
      end
    end)
    |> case do
      {:ok, result} -> {:ok, Enum.reverse(result)}
      error -> error
    end
  end

  defp tree_path(nodes, root) do
    by_node = Map.new(nodes, &{&1.node_id, &1})

    ancestors(root, by_node, MapSet.new())
    |> Enum.reverse()
    |> Enum.map(fn node ->
      snapshot = node_snapshot(node)
      %{node_id: node.node_id, title: snapshot["title"] || ""}
    end)
  end

  defp ancestors(nil, _by_node, _seen), do: []

  defp ancestors(node, by_node, seen) do
    if MapSet.member?(seen, node.node_id) do
      [node]
    else
      parent_id = node_snapshot(node)["parent_node_id"]
      parent = Map.get(by_node, parent_id)
      [node | ancestors(parent, by_node, MapSet.put(seen, node.node_id))]
    end
  end

  defp node_snapshot(node) do
    node.draft_snapshot || node.public_snapshot || node.queue_snapshot || %{}
  end

  defp revision_token(community, action, tree_revision, queue_revision) do
    payload =
      :erlang.term_to_binary(
        {:community_doc_trash_v1, community.id, action.hash_id, tree_revision, queue_revision},
        [:deterministic]
      )

    key =
      :groupher_server
      |> Application.fetch_env!(GroupherServerWeb.Endpoint)
      |> Keyword.fetch!(:secret_key_base)

    signature = :crypto.mac(:hmac, :sha256, key, payload)
    Base.url_encode64(signature, padding: false)
  end
end
