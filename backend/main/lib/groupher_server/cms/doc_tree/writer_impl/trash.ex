defmodule GroupherServer.CMS.DocTree.Writer.Trash do
  @moduledoc """
  Docs-specific orchestration for moving a Tree subtree into the shared Trash.

  The Tree owns placement snapshots for both draft and public stages. Article
  content remains in the normal Doc aggregate and is hidden by a
  `TrashedDocArticle` membership; no content is copied into Tree snapshots.

  Business position:

      Dashboard / public Docs
        -> CMS.DocTree
        -> Trash
        -> Repo / published projection
  """

  import Ecto.Query, warn: false

  alias GroupherServer.{CMS, Repo}
  alias GroupherServer.Accounts.Model.User
  alias CMS.Articles.MutationLock
  alias CMS.Docs.Trash
  alias CMS.DocTree.Events
  alias CMS.Model.{Community, DocTreeNode, TrashedDocTreeNode}
  alias CMS.SearchArtiments.Indexer

  require CMS.Const

  @doc "Moves the draft root and its corresponding draft/public subtrees into one Trash action."
  def trash_subtree(
        %Community{} = community,
        branch,
        %DocTreeNode{} = draft_root,
        %User{} = actor
      ) do
    draft_nodes = subtree_nodes(community, branch, draft_root, CMS.Const.stage(:draft))
    public_nodes = public_subtree_nodes(community, branch, draft_root.node_id)

    doc_ids =
      draft_nodes
      |> Enum.filter(&(&1.type == :page))
      |> Enum.map(& &1.doc_id)
      |> Enum.reject(&is_nil/1)
      |> Enum.uniq()

    MutationLock.with_articles(community, :doc, branch.id, doc_ids, fn ->
      with {:ok, action} <-
             Trash.create_action(community, actor, %{
               root_type: "doc_tree_#{draft_root.type}",
               root_ref: draft_root.node_id
             }),
           {:ok, trash_nodes} <-
             persist_nodes(action, community, branch, draft_nodes, public_nodes, actor),
           {:ok, _memberships} <- attach_docs(action, community, branch, doc_ids, actor),
           discarded_tree_events <-
             Events.discard_staged_for_trash(
               community,
               Enum.map(draft_nodes, & &1.node_id),
               doc_ids,
               branch_id: branch.id
             ),
           :ok <- delete_nodes(draft_nodes ++ public_nodes),
           {:ok, _audit} <-
             CMS.Audit.record("doc_tree.trashed", %{
               community_id: community.id,
               actor: actor,
               resource_type: "doc_tree_#{draft_root.type}",
               resource_ref: draft_root.node_id,
               resource_snapshot: %{
                 title: draft_root.title,
                 type: draft_root.type,
                 node_count: length(trash_nodes),
                 doc_count: length(doc_ids)
               },
               operation_ref: action.hash_id,
               source: "api",
               metadata: %{}
             }) do
        Enum.each(doc_ids, &Indexer.enqueue_delete(:doc, &1))

        {:ok,
         %{
           action: action,
           draft_nodes: draft_nodes,
           public_nodes: public_nodes,
           discarded_tree_events: discarded_tree_events
         }}
      end
    end)
  end

  @doc "Loads a structural subtree in one materialized Tree stage."
  def subtree_nodes(%Community{} = community, branch, %DocTreeNode{} = root, stage) do
    result =
      Repo.query!(
        """
        WITH RECURSIVE subtree(node_id) AS (
          SELECT node.node_id
          FROM cms.doc_tree_nodes AS node
          WHERE node.community_id = $1
            AND node.branch_id = $2
            AND node.stage = $3
            AND node.node_id = $4

          UNION

          SELECT child.node_id
          FROM cms.doc_tree_nodes AS child
          JOIN subtree AS parent ON child.parent_node_id = parent.node_id
          WHERE child.community_id = $1
            AND child.branch_id = $2
            AND child.stage = $3
        )
        SELECT node.*
        FROM cms.doc_tree_nodes AS node
        JOIN subtree ON subtree.node_id = node.node_id
        WHERE node.community_id = $1
          AND node.branch_id = $2
          AND node.stage = $3
        ORDER BY node."index" DESC, node.id DESC
        """,
        [community.id, branch.id, Atom.to_string(stage), root.node_id]
      )

    nodes = Enum.map(result.rows, &Repo.load(DocTreeNode, {result.columns, &1}))

    children_by_parent = Enum.group_by(nodes, & &1.parent_node_id)
    collect_subtree(root, children_by_parent, MapSet.new())
  end

  defp collect_subtree(%DocTreeNode{} = node, children_by_parent, seen) do
    if MapSet.member?(seen, node.node_id) do
      []
    else
      seen = MapSet.put(seen, node.node_id)

      descendants =
        children_by_parent
        |> Map.get(node.node_id, [])
        |> Enum.flat_map(&collect_subtree(&1, children_by_parent, seen))

      descendants ++ [node]
    end
  end

  defp public_subtree_nodes(%Community{} = community, branch, node_id) do
    case find_node(community, branch, node_id, CMS.Const.stage(:public)) do
      nil -> []
      public_root -> subtree_nodes(community, branch, public_root, CMS.Const.stage(:public))
    end
  end

  defp persist_nodes(action, community, branch, draft_nodes, public_nodes, actor) do
    drafts = Map.new(draft_nodes, &{&1.node_id, &1})
    publics = Map.new(public_nodes, &{&1.node_id, &1})
    now = DateTime.utc_now(:second)

    rows =
      (Map.keys(drafts) ++ Map.keys(publics))
      |> Enum.uniq()
      |> Enum.sort()
      |> Enum.map(fn node_id ->
        draft = Map.get(drafts, node_id)
        public = Map.get(publics, node_id)
        node = draft || public

        %{
          trash_action_id: action.id,
          community_id: community.id,
          branch_id: branch.id,
          node_id: node_id,
          doc_id: node.doc_id,
          type: node.type,
          draft_snapshot: snapshot(draft),
          public_snapshot: snapshot(public),
          deleted_by_id: actor.id,
          deleted_at: action.deleted_at,
          inserted_at: now,
          updated_at: now
        }
      end)

    case validate_trash_rows(rows) do
      :ok ->
        case Repo.insert_all(TrashedDocTreeNode, rows, returning: true) do
          {count, items} when count == length(rows) ->
            {:ok, Enum.sort_by(items, & &1.node_id)}

          {count, _items} ->
            {:error,
             GroupherServer.ErrorCat.custom(
               "Docs Tree Trash stored #{count} of #{length(rows)} expected snapshots"
             )}
        end

      {:error, changeset} ->
        {:error, changeset}
    end
  end

  defp validate_trash_rows(rows) do
    Enum.reduce_while(rows, :ok, fn row, :ok ->
      changeset = TrashedDocTreeNode.changeset(%TrashedDocTreeNode{}, row)

      if changeset.valid?,
        do: {:cont, :ok},
        else: {:halt, {:error, changeset}}
    end)
  end

  defp attach_docs(action, community, branch, doc_ids, actor) do
    Trash.attach_many(action, community, branch, doc_ids, actor,
      source: "api",
      audit: false,
      metadata: %{trash_root_type: action.root_type, trash_root_ref: action.root_ref}
    )
  end

  defp delete_nodes(nodes) do
    ids = nodes |> Enum.map(& &1.id) |> Enum.uniq()

    case ids do
      [] ->
        :ok

      ids ->
        {count, _} = DocTreeNode |> where([node], node.id in ^ids) |> Repo.delete_all()

        if count == length(ids),
          do: :ok,
          else: {:error, GroupherServer.ErrorCat.custom("Docs Tree changed during Trash")}
    end
  end

  defp base_nodes(%Community{} = community, branch, stage) do
    DocTreeNode
    |> where([node], node.community_id == ^community.id)
    |> where([node], node.branch_id == ^branch.id)
    |> where([node], node.stage == ^stage)
  end

  defp find_node(%Community{} = community, branch, node_id, stage) do
    base_nodes(community, branch, stage)
    |> where([node], node.node_id == ^to_string(node_id))
    |> Repo.one()
  end

  defp snapshot(nil), do: nil

  defp snapshot(%DocTreeNode{} = node) do
    %{
      "nodeId" => node.node_id,
      "type" => to_string(node.type),
      "parentNodeId" => node.parent_node_id,
      "docId" => node.doc_id,
      "title" => node.title,
      "index" => node.index,
      "href" => node.href,
      "marker" => node.marker,
      "badge" => node.badge,
      "hidden" => node.hidden
    }
  end
end
