defmodule GroupherServer.CMS.DocTree.Write.Trash do
  @moduledoc """
  Docs-specific orchestration for moving a Tree subtree into the shared Trash.

  The Tree owns placement snapshots for both draft and public stages. Article
  content remains in the normal Doc aggregate and is hidden by a
  `TrashedArticle` membership; no content is copied into Tree snapshots.

  Business position:

      Dashboard / public Docs
        -> CMS.DocTree
        -> Trash
        -> Repo / published projection
  """

  import Ecto.Query, warn: false

  alias GroupherServer.{CMS, Repo}
  alias GroupherServer.Accounts.Model.User
  alias CMS.Articles.{Lock, Trash}
  alias CMS.DocTree.Events
  alias CMS.Model.{Community, DocTreeNode, TrashedDocTreeNode}
  alias CMS.SearchArtiments.Indexer
  alias Helper.ORM

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

    Lock.run_many(community, :doc, doc_ids, fn ->
      with {:ok, action} <-
             Trash.create_action(community, actor, %{
               root_type: "doc_tree_#{draft_root.type}",
               root_ref: draft_root.node_id
             }),
           {:ok, trash_nodes} <-
             persist_nodes(action, community, branch, draft_nodes, public_nodes, actor),
           {:ok, _memberships} <- attach_docs(action, community, doc_ids, actor),
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
    nodes =
      base_nodes(community, branch, stage)
      |> order_by([node], desc: node.index, desc: node.id)
      |> Repo.all()

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

    (Map.keys(drafts) ++ Map.keys(publics))
    |> Enum.uniq()
    |> Enum.sort()
    |> Enum.reduce_while({:ok, []}, fn node_id, {:ok, items} ->
      draft = Map.get(drafts, node_id)
      public = Map.get(publics, node_id)
      node = draft || public

      attrs = %{
        trash_action_id: action.id,
        community_id: community.id,
        branch_id: branch.id,
        node_id: node_id,
        doc_id: node.doc_id,
        type: node.type,
        draft_snapshot: snapshot(draft),
        public_snapshot: snapshot(public),
        deleted_by_id: actor.id,
        deleted_at: action.deleted_at
      }

      case ORM.create(TrashedDocTreeNode, attrs) do
        {:ok, item} -> {:cont, {:ok, [item | items]}}
        error -> {:halt, error}
      end
    end)
    |> case do
      {:ok, items} -> {:ok, Enum.reverse(items)}
      error -> error
    end
  end

  defp attach_docs(action, community, doc_ids, actor) do
    Enum.reduce_while(doc_ids, {:ok, []}, fn doc_id, {:ok, items} ->
      case Trash.attach(action, community, :doc, doc_id, actor,
             source: "api",
             audit: false,
             metadata: %{trash_root_type: action.root_type, trash_root_ref: action.root_ref}
           ) do
        {:ok, item} -> {:cont, {:ok, [item | items]}}
        error -> {:halt, error}
      end
    end)
    |> case do
      {:ok, items} -> {:ok, Enum.reverse(items)}
      error -> error
    end
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
          else: {:error, {:custom, "Docs Tree changed during Trash"}}
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
