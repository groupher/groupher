defmodule GroupherServer.CMS.DocTree.Publish.PublicProjection do
  @moduledoc """
  Applies staged tree events to public doc tree rows.

      doc_tree_events(owner=tree, status=staged)
          |
          +--> node.create / pin.add    -> upsert public row
          +--> node.delete / pin.remove -> delete public row or subtree
          +--> node.move / pin.reorder  -> update parent/index
          +--> field updates            -> update public fields
          |
          v
      doc_tree_nodes(stage=public)

  This module materializes tree structure only. Article content publishing stays
  in `DocPublisher`, and release history stays in `Release`.
  """

  import Ecto.Query, warn: false

  alias GroupherServer.{CMS, Repo}
  alias CMS.Model.{Community, Doc, DocTreeEvent, DocTreeNode}
  alias Helper.ORM

  require CMS.Const

  @doc_tree_json_key_type CMS.Const.doc_tree_json_key(:type)
  @doc_tree_json_key_doc_id CMS.Const.doc_tree_json_key(:doc_id)
  @tree_node_type_tab CMS.Const.tree_node_type(:tab)
  @tree_node_type_group CMS.Const.tree_node_type(:group)
  @tree_node_type_page CMS.Const.tree_node_type(:page)
  @tree_node_type_link CMS.Const.tree_node_type(:link)
  @tree_node_type_pin CMS.Const.tree_node_type(:pin)
  @tree_node_type_group_key to_string(@tree_node_type_group)
  @tree_node_type_page_key to_string(@tree_node_type_page)
  @tree_node_type_link_key to_string(@tree_node_type_link)
  @tree_node_type_pin_key to_string(@tree_node_type_pin)
  @tree_node_type_tab_key to_string(@tree_node_type_tab)
  @temporary_index_offset 100_000

  @event_public_fields %{
    "title" => :title,
    "href" => :href,
    "marker" => :marker,
    "badge" => :badge,
    "hidden" => :hidden
  }

  @event_node_types %{
    @tree_node_type_tab_key => @tree_node_type_tab,
    @tree_node_type_group_key => @tree_node_type_group,
    @tree_node_type_page_key => @tree_node_type_page,
    @tree_node_type_link_key => @tree_node_type_link,
    @tree_node_type_pin_key => @tree_node_type_pin
  }

  @doc """
  Applies staged delete events before the remaining publish events.

  This removes public subtree roots first so later upserts cannot temporarily
  retain descendants whose draft ancestor was deleted.
  """
  def preapply_tree_delete_events(%Community{} = community, branch, events) do
    events
    |> Enum.filter(
      &(&1.event_type in [CMS.Const.tree_event(:node_delete), CMS.Const.tree_event(:pin_remove)])
    )
    |> apply_tree_events(community, branch)
  end

  @doc """
  Applies staged Tree events to the public projection.

  Both argument orders are supported because the publish pipeline and tests
  use different pipeline-friendly call shapes.
  """
  def apply_tree_events(events, %Community{} = community, branch),
    do: apply_tree_events(community, branch, events)

  def apply_tree_events(%Community{} = community, branch, events) do
    events
    |> Enum.reduce_while(:ok, fn event, :ok ->
      case apply_tree_event(community, branch, event) do
        :ok -> {:cont, :ok}
        {:ok, _node} -> {:cont, :ok}
        error -> {:halt, error}
      end
    end)
  end

  @doc """
  Returns every public descendant below a logical Tree node.

  The input and returned node identities use stable `node_id` values. The
  traversal groups one branch's public rows once and guards against malformed
  cycles instead of issuing a query per level.
  """
  def public_descendants(%Community{} = community, branch, parent_node_id) do
    nodes =
      DocTreeNode
      |> where([n], n.community_id == ^community.id)
      |> where([n], n.branch_id == ^branch.id)
      |> where([n], n.stage == CMS.Const.stage(:public))
      |> Repo.all()

    nodes
    |> Enum.group_by(& &1.parent_node_id)
    |> collect_descendants(parent_node_id, MapSet.new())
  end

  defp collect_descendants(children_by_parent, parent_node_id, seen) do
    if MapSet.member?(seen, parent_node_id) do
      []
    else
      seen = MapSet.put(seen, parent_node_id)

      children_by_parent
      |> Map.get(parent_node_id, [])
      |> Enum.flat_map(fn child ->
        [child | collect_descendants(children_by_parent, child.node_id, seen)]
      end)
    end
  end

  defp draft_node_by_node_id(%Community{} = community, branch, node_id) do
    DocTreeNode
    |> where([n], n.community_id == ^community.id)
    |> where([n], n.branch_id == ^branch.id)
    |> where([n], n.stage == CMS.Const.stage(:draft))
    |> where([n], n.node_id == ^to_string(node_id))
    |> Repo.one()
  end

  defp apply_tree_event(
         %Community{} = community,
         branch,
         %DocTreeEvent{event_type: type} = event
       )
       when type in [CMS.Const.tree_event(:node_create), CMS.Const.tree_event(:pin_add)] do
    event_node = event.payload["node"] || %{}
    draft = draft_node_by_node_id(community, branch, event_node["id"])
    node = authoritative_placement(event_node, draft)

    with :ok <- ensure_public_parent(community, branch, node),
         :ok <- sync_public_sibling_positions(community, branch, draft),
         {:ok, attrs} <- public_attrs_from_event_node(community, branch, node) do
      upsert_public_node_attrs(community, branch, node["id"], attrs)
    end
  end

  defp apply_tree_event(
         %Community{} = community,
         branch,
         %DocTreeEvent{event_type: type} = event
       )
       when type in [CMS.Const.tree_event(:node_delete), CMS.Const.tree_event(:pin_remove)] do
    node = event.payload["node"] || %{}

    delete_public_node_by_node_id(community, branch, node["id"], node["type"])
  end

  defp apply_tree_event(
         %Community{} = community,
         branch,
         %DocTreeEvent{event_type: type} = event
       )
       when type in [CMS.Const.tree_event(:node_move), CMS.Const.tree_event(:pin_reorder)] do
    payload = event.payload

    update_public_node_by_node_id(
      community,
      branch,
      payload["nodeId"],
      %{
        parent_node_id: payload["afterParentNodeId"],
        index: payload["afterIndex"]
      }
    )
  end

  defp apply_tree_event(%Community{} = community, branch, %DocTreeEvent{} = event) do
    apply_tree_event_fallback(community, branch, event)
  end

  defp apply_tree_event_fallback(%Community{} = community, branch, %DocTreeEvent{} = event) do
    payload = event.payload

    with {:ok, field} <- field_atom(payload["field"]) do
      update_public_node_by_node_id(community, branch, payload["nodeId"], %{
        field => payload["after"]
      })
    end
  end

  defp ensure_public_parent(_community, _branch, %{"type" => @tree_node_type_tab_key}), do: :ok

  defp ensure_public_parent(%Community{} = community, branch, %{
         "parentNodeId" => parent_node_id
       })
       when not is_nil(parent_node_id) do
    case public_node_by_node_id(community, branch, parent_node_id) do
      %DocTreeNode{} ->
        :ok

      nil ->
        case draft_node_by_node_id(community, branch, parent_node_id) do
          %DocTreeNode{type: type} = parent when type in [:tab, :group] ->
            with :ok <-
                   ensure_public_parent(community, branch, %{
                     "type" => to_string(parent.type),
                     "parentNodeId" => parent.parent_node_id
                   }),
                 {:ok, _} <- create_public_parent(community, branch, parent) do
              :ok
            end

          nil ->
            {:error, GroupherServer.ErrorCat.custom("Publish the parent navigation node first.")}

          %DocTreeNode{} ->
            {:error, GroupherServer.ErrorCat.custom("Navigation parent must be a Tab or Group.")}
        end
    end
  end

  defp ensure_public_parent(_community, _branch, _node),
    do: {:error, GroupherServer.ErrorCat.custom("Navigation parent is required.")}

  defp public_attrs_from_event_node(
         %Community{} = community,
         branch,
         %{@doc_tree_json_key_type => @tree_node_type_page_key} = node
       ) do
    doc_id = node[@doc_tree_json_key_doc_id]

    case ORM.find_by(Doc,
           doc_id: doc_id,
           branch_id: branch.id,
           community_id: community.id
         ) do
      {:ok, _draft} ->
        {:ok,
         %{
           community_id: community.id,
           branch_id: branch.id,
           node_id: node["id"],
           stage: CMS.Const.stage(:public),
           type: @tree_node_type_page,
           parent_node_id: node["parentNodeId"],
           doc_id: doc_id,
           title: node["title"],
           index: node["index"] || 0,
           href: node["href"],
           marker: node["marker"],
           badge: node["badge"],
           hidden: Map.get(node, "hidden", false)
         }}

      {:error, _} ->
        {:error, GroupherServer.ErrorCat.custom("Publish docs before publishing tree.")}
    end
  end

  defp public_attrs_from_event_node(%Community{} = community, branch, node) do
    with {:ok, type} <- node_type_atom(node["type"]) do
      {:ok,
       %{
         community_id: community.id,
         branch_id: branch.id,
         node_id: node["id"],
         stage: CMS.Const.stage(:public),
         type: type,
         parent_node_id: node["parentNodeId"],
         doc_id: nil,
         title: node["title"],
         index: node["index"] || 0,
         href: node["href"],
         marker: node["marker"],
         badge: node["badge"],
         hidden: Map.get(node, "hidden", false)
       }}
    end
  end

  defp upsert_public_node_attrs(%Community{} = community, branch, node_id, attrs) do
    case public_node_by_node_id(community, branch, node_id) do
      %DocTreeNode{} = node -> ORM.update(node, attrs)
      nil -> ORM.create(DocTreeNode, attrs)
    end
  end

  defp update_public_node_by_node_id(%Community{} = community, branch, node_id, attrs) do
    case public_node_by_node_id(community, branch, node_id) do
      %DocTreeNode{} = node ->
        ORM.update(node, attrs)

      nil ->
        {:ok, :missing}
    end
  end

  defp delete_public_node_by_node_id(%Community{} = community, branch, node_id, node_type) do
    case public_node_by_node_id(community, branch, node_id) do
      %DocTreeNode{type: type} = node when type in [:tab, :group] ->
        with :ok <- delete_public_descendants(community, branch, node.node_id) do
          ORM.delete(node)
        end

      %DocTreeNode{} = node ->
        ORM.delete(node)

      nil when node_type == @tree_node_type_tab_key ->
        delete_public_descendants(community, branch, node_id)

      nil when node_type == @tree_node_type_group_key ->
        delete_public_descendants(community, branch, node_id)

      nil ->
        {:ok, :missing}
    end
  end

  defp delete_public_descendants(%Community{} = community, branch, parent_node_id) do
    community
    |> public_descendants(branch, parent_node_id)
    |> Enum.reverse()
    |> Enum.reduce_while(:ok, fn node, :ok ->
      case ORM.delete(node) do
        {:ok, _node} -> {:cont, :ok}
        error -> {:halt, error}
      end
    end)
  end

  defp public_node_by_node_id(%Community{} = community, branch, node_id) do
    DocTreeNode
    |> where([n], n.community_id == ^community.id)
    |> where([n], n.branch_id == ^branch.id)
    |> where([n], n.stage == CMS.Const.stage(:public))
    |> where([n], n.node_id == ^to_string(node_id))
    |> Repo.one()
  end

  defp authoritative_placement(node, %DocTreeNode{} = draft) do
    node
    |> Map.put("parentNodeId", draft.parent_node_id)
    |> Map.put("index", draft.index)
  end

  defp authoritative_placement(node, _draft), do: node

  defp create_public_parent(%Community{} = community, branch, %DocTreeNode{} = parent) do
    with :ok <- sync_public_sibling_positions(community, branch, parent) do
      parent
      |> Map.take([
        :community_id,
        :branch_id,
        :node_id,
        :parent_node_id,
        :type,
        :title,
        :index,
        :hidden
      ])
      |> Map.put(:stage, CMS.Const.stage(:public))
      |> then(&ORM.create(DocTreeNode, &1))
    end
  end

  defp sync_public_sibling_positions(_community, _branch, nil), do: :ok

  defp sync_public_sibling_positions(
         %Community{} = community,
         branch,
         %DocTreeNode{} = draft
       ) do
    public_scope =
      DocTreeNode
      |> where([n], n.community_id == ^community.id)
      |> where([n], n.branch_id == ^branch.id)
      |> where([n], n.stage == CMS.Const.stage(:public))
      |> where_sibling_scope(draft.parent_node_id, draft.type)

    draft_indexes =
      DocTreeNode
      |> where([n], n.community_id == ^community.id)
      |> where([n], n.branch_id == ^branch.id)
      |> where([n], n.stage == CMS.Const.stage(:draft))
      |> where_sibling_scope(draft.parent_node_id, draft.type)
      |> select([n], {n.node_id, n.index})
      |> Repo.all()
      |> Map.new()

    public_nodes = Repo.all(public_scope)
    Repo.update_all(public_scope, inc: [index: @temporary_index_offset])

    Enum.each(public_nodes, fn node ->
      DocTreeNode
      |> where([n], n.id == ^node.id)
      |> Repo.update_all(set: [index: Map.get(draft_indexes, node.node_id, node.index)])
    end)

    :ok
  end

  defp where_sibling_scope(query, nil, @tree_node_type_tab),
    do: query |> where([n], is_nil(n.parent_node_id)) |> where([n], n.type == :tab)

  defp where_sibling_scope(query, parent_node_id, @tree_node_type_pin),
    do:
      query
      |> where([n], n.parent_node_id == ^parent_node_id)
      |> where([n], n.type == :pin)

  defp where_sibling_scope(query, parent_node_id, type)
       when type in [:group, :page, :link],
       do:
         query
         |> where([n], n.parent_node_id == ^parent_node_id)
         |> where([n], n.type in [:group, :page, :link])

  defp field_atom(field) do
    case Map.fetch(@event_public_fields, field) do
      {:ok, atom} -> {:ok, atom}
      :error -> {:error, GroupherServer.ErrorCat.custom("Unsupported docs tree field: #{field}")}
    end
  end

  defp node_type_atom(type) do
    case Map.fetch(@event_node_types, type) do
      {:ok, atom} ->
        {:ok, atom}

      :error ->
        {:error, GroupherServer.ErrorCat.custom("Unsupported docs tree node type: #{type}")}
    end
  end
end
